#!/usr/bin/env python3
import os
import json
import boto3
import requests
import base64
import subprocess
from typing import List, Dict, Any

def get_cloudflare_token():
    try:
        # Try to get from Kubernetes secret first
        result = subprocess.run(
            ['kubectl', 'get', 'secret', 'cloudflare-credentials', '-n', 'rinawarp-staging',
             '-o', 'jsonpath={.data.api-token}'],
            capture_output=True, text=True, check=True
        )
        return base64.b64decode(result.stdout.strip()).decode('utf-8')
    except subprocess.CalledProcessError:
        # Fall back to environment variable
        return os.environ.get('CLOUDFLARE_API_TOKEN')

def get_cloudflare_records(zone_name: str, token: str) -> List[Dict[str, Any]]:
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    # First get zone ID
    response = requests.get(
        'https://api.cloudflare.com/client/v4/zones',
        headers=headers,
        params={'name': zone_name}
    )
    response.raise_for_status()
    data = response.json()
    
    if not data['success'] or not data['result']:
        raise Exception('Zone not found')
    
    zone_id = data['result'][0]['id']
    
    # Get DNS records
    response = requests.get(
        f'https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records',
        headers=headers
    )
    response.raise_for_status()
    data = response.json()
    
    if not data['success']:
        raise Exception('Failed to get DNS records')
    
    return data['result']

def resolve_railway_cname(name: str, content: str, ttl: int = 300) -> Dict[str, Any]:
    try:
        # Use DNS to resolve the CNAME target
        import socket
        ip = socket.gethostbyname(content)
        return {
            'Action': 'UPSERT',
            'ResourceRecordSet': {
                'Name': name,
                'Type': 'A',
                'TTL': ttl,
                'ResourceRecords': [{'Value': ip}]
            }
        }
    except:
        return None

def cloudflare_to_route53_record(cf_record: Dict[str, Any], zone_name: str) -> Dict[str, Any]:
    # Skip NS and SOA records as Route 53 manages these
    if cf_record['type'] in ['NS', 'SOA']:
        return None
        
    # Convert Cloudflare record to Route 53 format
    name = cf_record['name']
    if name == zone_name:
        name = zone_name + '.'
    elif name.endswith(zone_name):
        name = name + '.'
    
    # Convert any Railway CNAME to A record
    if cf_record['type'] == 'CNAME' and 'railway.app' in cf_record['content']:
        result = resolve_railway_cname(name, cf_record['content'], cf_record.get('ttl', 300))
        if result:
            return result
        
    r53_record = {
        'Action': 'UPSERT',
        'ResourceRecordSet': {
            'Name': name,
            'Type': cf_record['type'],
            'TTL': cf_record.get('ttl', 300),
            'ResourceRecords': [{'Value': cf_record['content']}]
        }
    }
    
    # Handle special cases
    if cf_record['type'] == 'MX':
        # MX records need priority
        r53_record['ResourceRecordSet']['ResourceRecords'][0]['Value'] = f"{cf_record.get('priority', 10)} {cf_record['content']}"
    elif cf_record['type'] == 'TXT':
        # TXT records need quotes
        content = cf_record['content']
        if not content.startswith('"'):
            content = f'"{content}"'
        if not content.endswith('"'):
            content = f'{content}"'
        r53_record['ResourceRecordSet']['ResourceRecords'][0]['Value'] = content
        
    return r53_record

def sync_to_route53(records: List[Dict[str, Any]], zone_id: str):
    route53 = boto3.client('route53')
    
    # Group records into batches of 100 (Route 53 limit)
    batch_size = 100
    batches = [records[i:i + batch_size] for i in range(0, len(records), batch_size)]
    
    for batch in batches:
        changes = {'Changes': batch}
        route53.change_resource_record_sets(
            HostedZoneId=zone_id,
            ChangeBatch=changes
        )

def main():
    ZONE_NAME = 'rinawarptech.com'
    ROUTE53_ZONE_ID = 'Z0713202NJO49ZHK5ER1'
    
    try:
        # Get Cloudflare records
        token = get_cloudflare_token()
        if not token:
            raise Exception('Cloudflare API token not found')
            
        print(f'Fetching DNS records from Cloudflare for {ZONE_NAME}...')
        cf_records = get_cloudflare_records(ZONE_NAME, token)
        print(f'Found {len(cf_records)} records in Cloudflare')
        
        # Print Cloudflare records
        print('\nCloudflare records:')
        for record in cf_records:
            print(f"Type: {record['type']}, Name: {record['name']}, Content: {record['content']}")
        
        # Convert to Route 53 format, filtering out problematic records
        r53_records = []
        skipped_records = []
        for record in cf_records:
            # Skip CNAME at apex
            if record['type'] == 'CNAME' and record['name'] == ZONE_NAME:
                skipped_records.append(record)
                continue
                
            r53_record = cloudflare_to_route53_record(record, ZONE_NAME)
            if r53_record:
                r53_records.append(r53_record)
        
        print(f'\nConverting {len(r53_records)} records to Route 53 format...')
        if skipped_records:
            print('\nSkipped records that need manual handling:')
            for record in skipped_records:
                print(f"Type: {record['type']}, Name: {record['name']}, Content: {record['content']}")
        
        # Show records that will be created
        print('\nRecords to be created in Route 53:')
        for record in r53_records:
            rrs = record['ResourceRecordSet']
            values = [rr['Value'] for rr in rrs['ResourceRecords']]
            print(f"Type: {rrs['Type']}, Name: {rrs['Name']}, Values: {values}")
            
        # Confirm before proceeding
        response = input('\nDo you want to proceed with the DNS sync? (yes/no): ')
        if response.lower() != 'yes':
            print('Sync cancelled')
            return
            
        # Sync to Route 53
        print('\nSyncing records to Route 53...')
        sync_to_route53(r53_records, ROUTE53_ZONE_ID)
        print('Successfully synced DNS records to Route 53')
        
    except Exception as e:
        print(f'Error: {e}')

if __name__ == '__main__':
    main()
