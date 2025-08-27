#!/usr/bin/env python3
import os
import requests
import base64
import subprocess
import json
import time
from typing import Dict, Any

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

def get_dns_records(zone_id: str, token: str, record_type: str = None):
    """Get DNS records of a specific type."""
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    params = {}
    if record_type:
        params['type'] = record_type
    
    response = requests.get(
        f'https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records',
        headers=headers,
        params=params
    )
    response.raise_for_status()
    return response.json()

def delete_dns_record(zone_id: str, token: str, record_id: str):
    """Delete a DNS record."""
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    response = requests.delete(
        f'https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records/{record_id}',
        headers=headers
    )
    response.raise_for_status()
    return response.json()

def create_dns_record(zone_id: str, token: str, record: Dict[str, Any]):
    """Create a new DNS record."""
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    response = requests.post(
        f'https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records',
        headers=headers,
        json=record
    )
    response.raise_for_status()
    return response.json()

def main():
    try:
        # Get Cloudflare token
        token = get_cloudflare_token()
        if not token:
            raise Exception('Cloudflare API token not found')
        
        # Get zone ID
        print('Getting zone ID...')
        zone_id = get_zone_id(token)
        
        # Delete Route 53 NS records
        print('\nLooking for Route 53 NS records to remove...')
        route53_nameservers = [
            'ns-1525.awsdns-62.org',
            'ns-1686.awsdns-18.co.uk',
            'ns-769.awsdns-32.net',
            'ns-455.awsdns-56.com'
        ]
        
        records = get_dns_records(zone_id, token, 'NS')
        for record in records['result']:
            if record['content'] in route53_nameservers:
                print(f"Deleting NS record: {record['content']}")
                result = delete_dns_record(zone_id, token, record['id'])
                if result['success']:
                    print(f"✓ Successfully deleted NS record")
                else:
                    print(f"⨯ Failed to delete NS record")
        
        # Add ACM validation record
        print('\nAdding ACM validation record...')
        validation_record = {
            'type': 'CNAME',
            'name': '_87dcf068b52efd9d35831bcc920b95ff',
            'content': '_805ceb83cfdb2e0600616d81ffac9513.xlfgrmvvlj.acm-validations.aws',
            'proxied': False,
            'ttl': 300
        }
        
        result = create_dns_record(zone_id, token, validation_record)
        if result['success']:
            print('✓ Successfully added ACM validation record')
        else:
            print('⨯ Failed to add ACM validation record')
            print(f"Error: {json.dumps(result['errors'], indent=2)}")
        
        # Monitor certificate validation
        print('\nWaiting for ACM to validate the certificate...')
        cert_arn = 'arn:aws:acm:us-east-1:720237151757:certificate/b6fb0750-a12b-4a4a-b793-bb67f789ca52'
        
        while True:
            try:
                result = subprocess.run(
                    ['aws', 'acm', 'describe-certificate', '--certificate-arn', cert_arn, '--region', 'us-east-1'],
                    capture_output=True, text=True, check=True
                )
                cert_data = json.loads(result.stdout)
                status = cert_data['Certificate']['Status']
                print(f"\nCertificate status: {status}")
                
                if status == 'ISSUED':
                    print('✓ Certificate has been validated!')
                    break
                elif status == 'FAILED':
                    print('⨯ Certificate validation failed')
                    break
                
                print('Checking again in 30 seconds...')
                time.sleep(30)
                
            except Exception as e:
                print(f"Error checking certificate status: {e}")
                break
        
    except Exception as e:
        print(f'Error: {e}')

if __name__ == '__main__':
    main()
