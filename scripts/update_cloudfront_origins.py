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

def update_distribution_origin(dist_id, new_origin):
    """Update a CloudFront distribution's origin."""
    # First get the current config
    result = run_aws_command(f"aws cloudfront get-distribution-config --id {dist_id}")
    if not result:
        return False
    
    etag = result['ETag']
    config = result['DistributionConfig']
    
    # Update the origin domain name
    config['Origins']['Items'][0]['DomainName'] = new_origin
    
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
            'origin': 'rinawarp-terminal-production.up.railway.app'
        },
        {
            'id': 'E2ZCIDGI8E8OFA',  # docs.rinawarptech.com
            'origin': 'rinawarp-terminal-production.up.railway.app'
        },
        {
            'id': 'E1AKFRIQ3F0D3I',  # rinawarptech.com
            'origin': 'rinawarp-terminal-production.up.railway.app'
        },
        {
            'id': 'EU4HII8VPKGWN',   # www.rinawarptech.com
            'origin': 'rinawarp-terminal-production.up.railway.app'
        }
    ]
    
    print("Starting CloudFront updates...")
    for dist in distributions:
        dist_id = dist['id']
        new_origin = dist['origin']
        
        print(f"\nUpdating distribution {dist_id}...")
        success = update_distribution_origin(dist_id, new_origin)
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
            print(f"Distribution {dist['id']}: {status}")
            
            if status != 'Deployed':
                all_deployed = False
        
        if all_deployed:
            print("\n✓ All distributions deployed!")
            break
        
        print("\nWaiting 60 seconds before next check...")
        time.sleep(60)

if __name__ == '__main__':
    main()
