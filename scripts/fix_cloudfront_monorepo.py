#!/usr/bin/env python3
import subprocess
import json
import time
from datetime import datetime

def run_aws_command(command):
    """Run an AWS CLI command and return the JSON output."""
    result = subprocess.run(
        command.split(),
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        print(f"Error running command: {result.stderr}")
        return None
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        print(f"Error parsing JSON: {result.stdout}")
        return None

def update_distribution_config(dist_id, domain_type):
    """Update a CloudFront distribution's configuration."""
    # First get the current config
    result = run_aws_command(f"aws cloudfront get-distribution-config --id {dist_id}")
    if not result:
        return False
    
    etag = result['ETag']
    config = result['DistributionConfig']
    
    # Set base behavior for all distributions
    config['DefaultCacheBehavior'].update({
        'TargetOriginId': 'RailwayOrigin',
        'ViewerProtocolPolicy': 'redirect-to-https',
        'AllowedMethods': {
            'Items': ['GET', 'HEAD', 'OPTIONS', 'PUT', 'POST', 'PATCH', 'DELETE'],
            'Quantity': 7,
            'CachedMethods': {
                'Items': ['GET', 'HEAD'],
                'Quantity': 2
            }
        },
        'MinTTL': 0,
        'DefaultTTL': 0,
        'MaxTTL': 31536000,
        'Compress': True,
        'ForwardedValues': {
            'QueryString': True,
            'Cookies': {
                'Forward': 'all'
            },
            'Headers': {
                'Quantity': 1,
                'Items': ['*']
            }
        }
    })
    
    # Update origin path based on the domain type
    if domain_type == 'api':
        config['Origins']['Items'][0]['OriginPath'] = '/api'
    elif domain_type == 'docs':
        config['Origins']['Items'][0]['OriginPath'] = '/docs'
    else:
        config['Origins']['Items'][0]['OriginPath'] = ''
    
    # Save the updated config
    with open('temp_config.json', 'w') as f:
        json.dump(config, f)
    
    # Update the distribution
    result = run_aws_command(
        f"aws cloudfront update-distribution --id {dist_id} --distribution-config file://temp_config.json --if-match {etag}"
    )
    
    # Clean up
    subprocess.run(['rm', 'temp_config.json'])
    
    return result is not None

def main():
    # CloudFront distributions to update
    distributions = [
        {
            'id': 'E3EC96QLJ50NXE',  # api.rinawarptech.com
            'type': 'api'
        },
        {
            'id': 'E2ZCIDGI8E8OFA',  # docs.rinawarptech.com
            'type': 'docs'
        },
        {
            'id': 'E1AKFRIQ3F0D3I',  # rinawarptech.com
            'type': 'main'
        },
        {
            'id': 'EU4HII8VPKGWN',   # www.rinawarptech.com
            'type': 'main'
        }
    ]
    
    print("Starting CloudFront updates...")
    for dist in distributions:
        dist_id = dist['id']
        dist_type = dist['type']
        
        print(f"\nUpdating distribution {dist_id} ({dist_type})...")
        success = update_distribution_config(dist_id, dist_type)
        if success:
            print(f"✓ Successfully updated distribution {dist_id}")
        else:
            print(f"⨯ Failed to update distribution {dist_id}")
    
    print("\nWaiting for distributions to deploy...")
    while True:
        print(f"\n{datetime.now().strftime('%H:%M:%S')} - Checking status:")
        
        all_deployed = True
        for dist in distributions:
            result = run_aws_command(f"aws cloudfront get-distribution --id {dist['id']}")
            if not result:
                print(f"⨯ Failed to get status for {dist['id']}")
                continue
                
            status = result['Distribution']['Status']
            print(f"Distribution {dist['id']} ({dist['type']}): {status}")
            
            if status != 'Deployed':
                all_deployed = False
        
        if all_deployed:
            print("\n✓ All distributions deployed!")
            break
        
        print("\nWaiting 60 seconds before next check...")
        time.sleep(60)

if __name__ == '__main__':
    main()
