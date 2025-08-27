#!/usr/bin/env python3
import os
import requests
import base64
import subprocess
from typing import Dict, Any
import json

def get_cloudflare_token():
    """Get Cloudflare API token from Kubernetes secret."""
    try:
        result = subprocess.run(
            ['kubectl', 'get', 'secret', 'cloudflare-credentials', '-n', 'rinawarp-staging',
             '-o', 'jsonpath={.data.api-token}'],
            capture_output=True, text=True, check=True
        )
        return base64.b64decode(result.stdout.strip()).decode('utf-8')
    except subprocess.CalledProcessError:
        return os.environ.get('CLOUDFLARE_API_TOKEN')

def get_zone_id(token: str) -> str:
    """Get Cloudflare zone ID for rinawarptech.com."""
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    response = requests.get(
        'https://api.cloudflare.com/client/v4/zones',
        headers=headers,
        params={'name': 'rinawarptech.com'}
    )
    response.raise_for_status()
    data = response.json()
    
    if not data['success'] or not data['result']:
        raise Exception('Zone not found')
    
    return data['result'][0]['id']

def update_dns_record(zone_id: str, token: str, record: Dict[str, Any]):
    """Update or create a DNS record."""
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    # First try to find existing record
    response = requests.get(
        f'https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records',
        headers=headers,
        params={'name': record['name'], 'type': record['type']}
    )
    response.raise_for_status()
    data = response.json()
    
    if data['success'] and data['result']:
        # Update existing record
        record_id = data['result'][0]['id']
        response = requests.put(
            f'https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records/{record_id}',
            headers=headers,
            json=record
        )
    else:
        # Create new record
        response = requests.post(
            f'https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records',
            headers=headers,
            json=record
        )
    
    response.raise_for_status()
    return response.json()

def delete_record(zone_id: str, token: str, rec    records = [
        # ACM validation record
        {
            'type': 'CNAME',
            'name': '_87dcf068b52efd9d35831bcc920b95ff',
            'content': '_805ceb83cfdb2e0600616d81ffac9513.xlfgrmvvlj.acm-validations.aws',
            'proxied': False,
            'ttl': 300
        }
    ]
    
    try:
        token = get_cloudflare_token()
        if not token:
            raise Exception('Cloudflare API token not found')
        
        print('Getting zone ID...')
        zone_id = get_zone_id(token)
        
        # First, delete any existing NS records
        print('\nLooking for NS records to remove...')
        ns_records = get_records(zone_id, token, 'NS')
        if ns_records['success'] and ns_records['result']:
            route53_ns = [
                'ns-1525.awsdns-62.org',
                'ns-1686.awsdns-18.co.uk',
                'ns-769.awsdns-32.net',
                'ns-455.awsdns-56.com'
            ]
            for record in ns_records['result']:
                if record['content'] in route53_ns:
                    print(f"Deleting NS record: {record['content']}")
                    try:
                        delete_record(zone_id, token, record['id'])
                        print(f"✓ Successfully deleted NS record: {record['content']}")
                    except Exception as e:
                        print(f"⨯ Error deleting NS record: {record['content']}: {e}")
        
        # Add ACM validation record
        print('\nAdding ACM validation record...')
        for record in records:
            print(f"\nProcessing {record['type']} record for {record['name']}...")
            try:
                result = update_dns_record(zone_id, token, record)
                if result['success']:
                    print(f"✓ Successfully added {record['type']} record for {record['name']}")
                else:
                    print(f"⨯ Failed to add {record['type']} record for {record['name']}")
                    print(f"Error: {json.dumps(result['errors'], indent=2)}")
            except Exception as e:
                print(f"⨯ Error adding {record['type']} record for {record['name']}: {e}")
        
        print('\nDNS update complete!')
        print('\nWaiting for ACM to validate the certificate...')
        
        # Check ACM certificate status
        cert_arn = 'arn:aws:acm:us-east-1:720237151757:certificate/b6fb0750-a12b-4a4a-b793-bb67f789ca52'
        while True:
            try:
                result = subprocess.run(
                    ['aws', 'acm', 'describe-certificate', '--certificate-arn', cert_arn, '--region', 'us-east-1'],
                    capture_output=True, text=True, check=True
                )
                cert_data = json.loads(result.stdout)
                status = cert_data['Certificate']['Status']
                print(f"Certificate status: {status}")
                if status == 'ISSUED':
                    print('\n✓ Certificate has been validated!')
                    break
                elif status == 'FAILED':
                    print('\n⨯ Certificate validation failed')
                    break
            except Exception as e:
                print(f"Error checking certificate status: {e}")
                break
            
            print('Checking again in 30 seconds...')
            time.sleep(30)
        
    except Exception as e:
        print(f'Error: {e}')

if __name__ == '__main__':
    main()
