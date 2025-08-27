#!/usr/bin/env python3
import os
import json
import requests
import base64
import subprocess

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

def update_nameservers():
    # AWS Route 53 nameservers
    new_nameservers = [
        'ns-1525.awsdns-62.org',
        'ns-1686.awsdns-18.co.uk',
        'ns-769.awsdns-32.net',
        'ns-455.awsdns-56.com'
    ]
    
    try:
        # Get Cloudflare API token
        token = get_cloudflare_token()
        if not token:
            raise Exception('Cloudflare API token not found in Kubernetes secrets or environment')

        # Common headers for all requests
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }

        # Get zone ID
        response = requests.get(
            'https://api.cloudflare.com/client/v4/zones',
            headers=headers,
            params={'name': 'rinawarptech.com'}
        )
        data = response.json()
        print(f'Zone request response: {json.dumps(data, indent=2)}')
        response.raise_for_status()

        if not data['success'] or not data['result']:
            raise Exception('Zone not found')

        zone_id = data['result'][0]['id']

        # Update nameservers using settings endpoint
        response = requests.put(
            f'https://api.cloudflare.com/client/v4/zones/{zone_id}/settings/vanity_nameservers',
            headers=headers,
            json={
                'value': new_nameservers
            }
        )
        data = response.json()
        print(f'Nameserver update response: {json.dumps(data, indent=2)}')
        response.raise_for_status()

        if not data['success']:
            raise Exception('Failed to update nameservers')

        print('Successfully updated nameservers to:')
        for ns in new_nameservers:
            print(f'  - {ns}')
            
    except requests.exceptions.RequestException as e:
        print(f'API Error: {e}')
    except Exception as e:
        print(f'Error: {e}')

if __name__ == '__main__':
    
    update_nameservers()
