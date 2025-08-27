#!/usr/bin/env python3
import os
import requests
import base64
import subprocess
import json
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

def get_dns_records(zone_id: str, token: str):
    """Get all DNS records."""
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    response = requests.get(
        f'https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records',
        headers=headers
    )
    response.raise_for_status()
    return response.json()

def update_dns_record(zone_id: str, token: str, record: Dict[str, Any]):
    """Update or create a DNS record."""
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    # Get all records to find the exact one we want to update
    records = get_dns_records(zone_id, token)
    record_id = None
    
    # Find the record by full domain name
    full_name = f"{record['name']}.rinawarptech.com"
    if record['name'] == 'rinawarptech.com':
        full_name = record['name']
    
    for r in records['result']:
        if r['name'] == full_name and r['type'] == record['type']:
            record_id = r['id']
            break
    
    if record_id:
        # Update existing record
        print(f"Found existing record with ID {record_id}")
        response = requests.put(
            f'https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records/{record_id}',
            headers=headers,
            json=record
        )
    else:
        # Create new record
        print("Creating new record")
        response = requests.post(
            f'https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records',
            headers=headers,
            json=record
        )
    
    response.raise_for_status()
    return response.json()

def main():
    # CloudFront distributions
    distributions = [
        {
            'domain': 'api.rinawarptech.com',
            'cloudfront': 'd9db5a94dictq.cloudfront.net'
        },
        {
            'domain': 'docs.rinawarptech.com',
            'cloudfront': 'd1cabz99ab90wf.cloudfront.net'
        },
        {
            'domain': 'rinawarptech.com',
            'cloudfront': 'dbj4krew5gpfp.cloudfront.net'
        },
        {
            'domain': 'www.rinawarptech.com',
            'cloudfront': 'd361asqhi0ugoo.cloudfront.net'
        }
    ]
    
    try:
        token = get_cloudflare_token()
        if not token:
            raise Exception('Cloudflare API token not found')
        
        print('Getting zone ID...')
        zone_id = get_zone_id(token)
        
        print('\nUpdating DNS records to use CloudFront:')
        
        # First get all current records
        print('Fetching current DNS records...')
        current_records = get_dns_records(zone_id, token)
        print(f"Found {len(current_records['result'])} records")
        
        for dist in distributions:
            domain = dist['domain']
            cloudfront = dist['cloudfront']
            
            # If it's the apex domain, we need to handle it differently
            if domain == 'rinawarptech.com':
                name = domain
            else:
                # For subdomains, just use the subdomain part
                name = domain.replace('.rinawarptech.com', '')
            
            record = {
                'type': 'CNAME',
                'name': name,
                'content': cloudfront,
                'proxied': True,  # Keep Cloudflare proxy enabled
                'ttl': 1  # Auto
            }
            
            print(f"\nUpdating {domain} to point to CloudFront distribution {cloudfront}...")
            try:
                result = update_dns_record(zone_id, token, record)
                if result['success']:
                    print(f"✓ Successfully updated DNS record")
                else:
                    print(f"⨯ Failed to update DNS record")
                    print(f"Error: {json.dumps(result['errors'], indent=2)}")
            except Exception as e:
                print(f"⨯ Error updating DNS record: {e}")
                print("Details of the error:")
                print(f"Record data: {json.dumps(record, indent=2)}")
        
        print('\nDNS update complete!')
        print('\nPlease note:')
        print('1. DNS changes may take a few minutes to propagate')
        print('2. CloudFront distributions may take 15-30 minutes to fully deploy')
        print('3. Keep Cloudflare proxy enabled (orange cloud) for added protection')
        
    except Exception as e:
        print(f'Error: {e}')

if __name__ == '__main__':
    main()
