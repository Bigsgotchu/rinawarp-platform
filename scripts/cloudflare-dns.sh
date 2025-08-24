#!/bin/bash

# Example: Add a DNS record
add_dns_record() {
  local NAME=$1
  local CONTENT=$2
  
  curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/dns_records" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json" \
    --data "{\"type\":\"CNAME\",\"name\":\"$NAME\",\"content\":\"$CONTENT\",\"proxied\":true}"
}

# Example: List DNS records
list_dns_records() {
  curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/dns_records" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json"
}

# Usage example:
# ./cloudflare-dns.sh add api rinawarp-terminal-production.up.railway.app
if [ "$1" = "add" ]; then
  add_dns_record "$2" "$3"
elif [ "$1" = "list" ]; then
  list_dns_records
else
  echo "Usage: $0 {add NAME CONTENT|list}"
  exit 1
fi
