#!/usr/bin/env python3
import sys
from cloudflare import Cloudflare

def add_cname_record(token, zone_name, record_name, target):
    cf = Cloudflare(token=token)
    
    # Get zone ID
    try:
        zones = cf.zones.get(params={'name': zone_name})
        if not zones:
            print(f"Error: Zone {zone_name} not found")
            return False
        zone_id = zones[0]['id']
    except Exception as e:
        print(f"Error getting zone: {e}")
        return False

    # Create CNAME record
    record = {
        'name': record_name,
        'type': 'CNAME',
        'content': target,
        'proxied': True
    }

    try:
        cf.zones.dns_records.post(zone_id, data=record)
        print(f"Successfully added CNAME record: {record_name} -> {target}")
        return True
    except Exception as e:
        print(f"Error creating DNS record: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) != 5:
        print("Usage: python3 cf-dns.py <api_token> <zone_name> <record_name> <target>")
        print("Example: python3 cf-dns.py YOUR_TOKEN rinawarptech.com docs 548iv9i4.up.railway.app")
        sys.exit(1)

    token = sys.argv[1]
    zone = sys.argv[2]
    record = sys.argv[3]
    target = sys.argv[4]

    add_cname_record(token, zone, record, target)
