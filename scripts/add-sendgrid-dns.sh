#!/bin/bash

# Cloudflare account settings
EMAIL="rinawarptechnologies25@gmail.com"
ZONE_ID="2a5d9b9e9bb3675812dda0d66d1f2c3b"
API_KEY="9226fcb4b98248230050811a3cbd097f2c7b2"

# Function to add DNS record
add_dns_record() {
    local type=$1
    local name=$2
    local content=$3
    
    echo "Adding $type record for $name..."
    curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
         -H "X-Auth-Email: $EMAIL" \
-H "X-Auth-Key: $API_KEY"
         -H "Content-Type: application/json" \
         -d "{
           \"type\": \"$type\",
           \"name\": \"$name\",
           \"content\": \"$content\",
           \"ttl\": 3600,
           \"proxied\": false
         }"
    echo -e "\n"
    sleep 2
}

# Add all SendGrid DNS records
add_dns_record "CNAME" "url5321" "sendgrid.net"
add_dns_record "CNAME" "54111029" "sendgrid.net"
add_dns_record "CNAME" "em1088" "u54111029.wl030.sendgrid.net"
add_dns_record "CNAME" "s1._domainkey" "s1.domainkey.u54111029.wl030.sendgrid.net"
add_dns_record "CNAME" "s2._domainkey" "s2.domainkey.u54111029.wl030.sendgrid.net"
add_dns_record "TXT" "_dmarc" "v=DMARC1; p=none;"
