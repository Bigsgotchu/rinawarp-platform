#!/usr/bin/env python3
import subprocess
import json
import time
import sys
import requests
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

def get_distribution_status(distribution_id):
    """Get the status of a CloudFront distribution."""
    result = run_aws_command(f"aws cloudfront get-distribution --id {distribution_id}")
    if not result:
        return None, None
    
    return (
        result['Distribution']['Status'],
        result['Distribution']['DistributionConfig']['Enabled']
    )

def test_domain(domain):
    """Test a domain by making an HTTPS request."""
    try:
        response = requests.get(f"https://{domain}", timeout=10)
        return {
            'status_code': response.status_code,
            'success': response.status_code == 200,
            'error': None
        }
    except requests.exceptions.RequestException as e:
        return {
            'status_code': None,
            'success': False,
            'error': str(e)
        }

def main():
    # CloudFront distributions to monitor
    distributions = [
        {
            'domain': 'api.rinawarptech.com',
            'id': 'E3EC96QLJ50NXE',  # api.rinawarptech.com
            'cloudfront': 'd9db5a94dictq.cloudfront.net'
        },
        {
            'domain': 'docs.rinawarptech.com',
            'id': 'E2ZCIDGI8E8OFA',  # docs.rinawarptech.com
            'cloudfront': 'd1cabz99ab90wf.cloudfront.net'
        },
        {
            'domain': 'rinawarptech.com',
            'id': 'E1AKFRIQ3F0D3I',  # rinawarptech.com
            'cloudfront': 'dbj4krew5gpfp.cloudfront.net'
        },
        {
            'domain': 'www.rinawarptech.com',
            'id': 'EU4HII8VPKGWN',  # www.rinawarptech.com
            'cloudfront': 'd361asqhi0ugoo.cloudfront.net'
        }
    ]
    
    print("Starting deployment monitoring...")
    
    while True:
        print(f"\n{datetime.now().strftime('%H:%M:%S')} - Checking distributions:")
        
        all_deployed = True
        for dist in distributions:
            status, enabled = get_distribution_status(dist['id'])
            print(f"\n{dist['domain']}:")
            print(f"  CloudFront: {dist['cloudfront']}")
            print(f"  Status: {status}")
            print(f"  Enabled: {enabled}")
            
            if status != 'Deployed':
                all_deployed = False
        
        if all_deployed:
            print("\n✓ All CloudFront distributions are deployed!")
            break
            
        print("\nWaiting 60 seconds before next check...")
        time.sleep(60)
    
    print("\nTesting domains...")
    all_success = True
    
    for dist in distributions:
        domain = dist['domain']
        print(f"\nTesting {domain}...")
        
        # Test the domain
        result = test_domain(domain)
        if result['success']:
            print(f"✓ {domain} is working (Status: {result['status_code']})")
        else:
            all_success = False
            print(f"⨯ {domain} failed: {result['error'] or f'Status: {result['status_code']}'}")
        
        # Test the CloudFront domain
        print(f"Testing {dist['cloudfront']}...")
        result = test_domain(dist['cloudfront'])
        if result['success']:
            print(f"✓ CloudFront domain is working (Status: {result['status_code']})")
        else:
            all_success = False
            print(f"⨯ CloudFront domain failed: {result['error'] or f'Status: {result['status_code']}'}")
    
    if all_success:
        print("\n✓ All domains are working!")
    else:
        print("\n⨯ Some domains failed the test")
        print("Note: DNS changes might still be propagating. Try again in a few minutes.")

if __name__ == '__main__':
    main()
