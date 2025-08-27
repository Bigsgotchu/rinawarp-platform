#!/usr/bin/env python3
import os
import requests
import json
import base64
import subprocess

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

def get_zone_id(token):
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

def create_page_rule(zone_id, token, url_pattern, actions):
    """Create a Cloudflare Page Rule."""
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    data = {
        'targets': [
            {
                'target': 'url',
                'constraint': {
                    'operator': 'matches',
                    'value': url_pattern
                }
            }
        ],
        'actions': actions,
        'priority': 1,
        'status': 'active'
    }
    
    response = requests.post(
        f'https://api.cloudflare.com/client/v4/zones/{zone_id}/pagerules',
        headers=headers,
        json=data
    )
    response.raise_for_status()
    return response.json()

def update_dns_record(zone_id, token, name, type='CNAME'):
    """Update DNS record to point to the main domain."""
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    # First find the record
    response = requests.get(
        f'https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records',
        headers=headers,
        params={'name': f'{name}.rinawarptech.com', 'type': type}
    )
    response.raise_for_status()
    data = response.json()
    
    if not data['success']:
        raise Exception('Failed to get DNS records')
        
    record_id = None
    if data['result']:
        record_id = data['result'][0]['id']
    
    record = {
        'type': type,
        'name': name,
        'content': 'rinawarptech.com',
        'proxied': True,
        'ttl': 1
    }
    
    if record_id:
        # Update existing record
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

def main():
    # Get Cloudflare token
    token = get_cloudflare_token()
    if not token:
        print("Error: Cloudflare API token not found")
        return
    
    # Get zone ID
    print("Getting zone ID...")
    zone_id = get_zone_id(token)
    
    # Update DNS records to point to main domain
    print("\nUpdating DNS records...")
    
    subdomains = ['api', 'docs']
    for subdomain in subdomains:
        print(f"\nUpdating {subdomain}.rinawarptech.com...")
        try:
            result = update_dns_record(zone_id, token, subdomain)
            if result['success']:
                print(f"✓ Successfully updated DNS record")
            else:
                print(f"⨯ Failed to update DNS record")
                print(f"Error: {json.dumps(result['errors'], indent=2)}")
        except Exception as e:
            print(f"⨯ Error updating DNS record: {e}")
    
    # Create page rules for redirects
    print("\nSetting up page rules...")
    
    redirects = [
        {
            'pattern': 'api.rinawarptech.com/*',
            'target': 'rinawarptech.com/api/$1'
        },
        {
            'pattern': 'docs.rinawarptech.com/*',
            'target': 'rinawarptech.com/docs/$1'
        }
    ]
    
    for redirect in redirects:
        print(f"\nCreating page rule for {redirect['pattern']}...")
        try:
            result = create_page_rule(
                zone_id,
                token,
                redirect['pattern'],
                [
                    {
                        'id': 'forwarding_url',
                        'value': {
                            'url': f'https://{redirect["target"]}',
                            'status_code': 301
                        }
                    }
                ]
            )
            if result['success']:
                print(f"✓ Successfully created page rule")
            else:
                print(f"⨯ Failed to create page rule")
                print(f"Error: {json.dumps(result['errors'], indent=2)}")
        except Exception as e:
            print(f"⨯ Error creating page rule: {e}")
    
    print("\nSetup complete!")

if __name__ == '__main__':
    main()
