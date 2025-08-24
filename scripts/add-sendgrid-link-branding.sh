#!/bin/bash

# Cloudflare credentials
EMAIL="rinawarptechnologies25@gmail.com"
ZONE_ID="2a5d9b9e9bb3675812dda0d66d1f2c3b"
API_KEY="9226fcb4b98248230050811a3cbd097f2c7b2"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to add DNS record with retry
add_dns_record() {
    local type=$1
    local name=$2
    local content=$3
    local max_retries=3
    local retry_count=0
    local success=false

    echo -e "${YELLOW}Adding ${type} record for ${name}...${NC}"
    
    while [ $retry_count -lt $max_retries ] && [ "$success" = false ]; do
        response=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
            -H "X-Auth-Email: $EMAIL" \
            -H "X-Auth-Key: $API_KEY" \
            -H "Content-Type: application/json" \
            -d "{
                \"type\": \"$type\",
                \"name\": \"$name\",
                \"content\": \"$content\",
                \"ttl\": 3600,
                \"proxied\": false
            }")
        
        if echo "$response" | grep -q '"success":true'; then
            echo -e "${GREEN}✓ Successfully added $type record for $name${NC}"
            success=true
        else
            error_msg=$(echo "$response" | grep -o '"message":"[^"]*"' | cut -d'"' -f4)
            retry_count=$((retry_count + 1))
            
            if [ $retry_count -lt $max_retries ]; then
                echo -e "${YELLOW}⚠ Failed to add record (${error_msg}). Retrying in 5 seconds...${NC}"
                sleep 5
            else
                echo -e "${RED}✗ Failed to add record after $max_retries attempts: ${error_msg}${NC}"
            fi
        fi
    done
    
    sleep 2
}

# Verify Cloudflare access
echo -e "${YELLOW}Verifying Cloudflare credentials...${NC}"
auth_test=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?per_page=1" \
    -H "X-Auth-Email: $EMAIL" \
    -H "X-Auth-Key: $API_KEY" \
    -H "Content-Type: application/json")

if ! echo "$auth_test" | grep -q '"success":true'; then
    echo -e "${RED}✗ Failed to authenticate with Cloudflare. Please check your credentials.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Cloudflare authentication successful${NC}"

# Add SendGrid link branding DNS records
echo -e "\n${YELLOW}Adding SendGrid link branding DNS records...${NC}"

# CNAME records
add_dns_record "CNAME" "url8309.rinawarptech.com" "sendgrid.net"
add_dns_record "CNAME" "54111029.rinawarptech.com" "sendgrid.net"

# Verify records were added
echo -e "\n${YELLOW}Verifying DNS records...${NC}"
records=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?per_page=200" \
    -H "X-Auth-Email: $EMAIL" \
    -H "X-Auth-Key: $API_KEY" \
    -H "Content-Type: application/json")

verify_record() {
    local name=$1
    if echo "$records" | grep -q "\"name\":\"$name\""; then
        echo -e "${GREEN}✓ Found record: $name${NC}"
    else
        echo -e "${RED}✗ Missing record: $name${NC}"
    fi
}

verify_record "url8309.rinawarptech.com"
verify_record "54111029.rinawarptech.com"

echo -e "\n${YELLOW}Setup complete! Please wait 5-10 minutes for DNS propagation, then verify in SendGrid.${NC}"
