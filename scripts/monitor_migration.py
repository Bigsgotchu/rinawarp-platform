#!/usr/bin/env python3
import subprocess
import json
import time
import sys
from datetime import datetime

def run_command(command):
    """Run a shell command and return the output."""
    result = subprocess.run(command.split(), capture_output=True, text=True)
    return result.stdout.strip()

def check_nameservers():
    """Check if Route 53 nameservers are answering for the domain."""
    expected_ns = {
        'ns-1525.awsdns-62.org.',
        'ns-1686.awsdns-18.co.uk.',
        'ns-769.awsdns-32.net.',
        'ns-455.awsdns-56.com.'
    }
    
    # Get current nameservers
    current_ns = set(run_command('dig ns rinawarptech.com +short').split('\n'))
    
    return current_ns, current_ns == expected_ns

def check_certificate():
    """Check ACM certificate validation status."""
    cert_arn = 'arn:aws:acm:us-east-1:720237151757:certificate/b6fb0750-a12b-4a4a-b793-bb67f789ca52'
    result = run_command(f'aws acm describe-certificate --certificate-arn {cert_arn} --region us-east-1')
    cert_data = json.loads(result)
    return cert_data['Certificate']['Status']

def main():
    print("Starting migration monitoring...")
    print("Expected nameservers:")
    print("  ns-1525.awsdns-62.org")
    print("  ns-1686.awsdns-18.co.uk")
    print("  ns-769.awsdns-32.net")
    print("  ns-455.awsdns-56.com")
    print("\nMonitoring nameserver propagation and certificate validation...")
    
    while True:
        now = datetime.now().strftime('%H:%M:%S')
        current_ns, ns_match = check_nameservers()
        cert_status = check_certificate()
        
        print(f"\n{now} Status:")
        print("Current nameservers:")
        for ns in sorted(current_ns):
            print(f"  {ns}")
        print(f"Nameserver status: {'✓ MATCH' if ns_match else '⨯ NO MATCH'}")
        print(f"Certificate status: {cert_status}")
        
        if ns_match and cert_status == 'ISSUED':
            print("\nMigration prerequisites complete!")
            print("Ready to create CloudFront distributions.")
            break
            
        # Wait 60 seconds before next check
        print("\nChecking again in 60 seconds... (Ctrl+C to stop)")
        try:
            time.sleep(60)
        except KeyboardInterrupt:
            print("\nMonitoring stopped.")
            sys.exit(0)

if __name__ == '__main__':
    main()
