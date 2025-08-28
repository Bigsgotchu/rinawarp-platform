#!/bin/bash

# Rate Limit Test Script
# Tests the API rate limiting functionality by:
# 1. Making an initial request to check headers
# 2. Rapidly making requests until rate limit is hit
# 3. Waiting for rate limit window to reset
# 4. Verifying rate limit reset

# Configuration
API_URL="http://localhost:3000"
ENDPOINT="/_rltest"  # Dedicated rate limit test endpoint
MAX_REQUESTS=200      # Maximum number of test requests
RESET_WAIT=65        # Seconds to wait for rate limit reset

# Colors for output
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m"  # No Color

# Function to make request and extract headers
make_request() {
    local resp=$(curl -s -i "$API_URL$ENDPOINT")
    local sc=$(printf "%s" "$resp" | sed -n '1s/.*\ \([0-9][0-9][0-9]\).*/\1/p')
    local rem=$(printf "%s" "$resp" | grep -i '^X-RateLimit-Remaining:' | awk '{print $2}')
    local ra=$(printf "%s" "$resp" | grep -i '^Retry-After:' | awk '{print $2}')
    echo "$sc:$rem:$ra:$resp"
}

echo -e "${GREEN}Rate Limit Testing Script${NC}"
echo -e "Testing against: ${YELLOW}$API_URL$ENDPOINT${NC}"

# Initial request to check headers
echo -e "\n${GREEN}1. Initial request (showing rate limit headers):${NC}"
curl -s -i "$API_URL$ENDPOINT" | sed -n '/^HTTP/p;/^X-RateLimit/p;/^Retry-After/p'
echo

# Test rate limit
echo -e "\n${GREEN}2. Making rapid requests until rate limit is hit:${NC}"
for i in $(seq 1 $MAX_REQUESTS); do
    result=$(make_request)
    sc=$(echo $result | cut -d':' -f1)
    rem=$(echo $result | cut -d':' -f2)
    ra=$(echo $result | cut -d':' -f3)
    
    # Color status code based on value
    status_color=$GREEN
    [[ $sc -ge 400 ]] && status_color=$RED
    [[ $sc -ge 300 && $sc -lt 400 ]] && status_color=$YELLOW
    
    echo -e "Request $i: status=${status_color}${sc}${NC} remaining=${YELLOW}${rem:-n/a}${NC} retry_after=${YELLOW}${ra:-n/a}${NC}"
    
    # Break if we hit the rate limit
    [[ "$sc" = "429" ]] && break
    
    sleep 0.05  # Small delay to make output readable
done

# Wait for reset
echo -e "\n${GREEN}3. Waiting $RESET_WAIT seconds for rate limit window to reset...${NC}"
sleep $RESET_WAIT

# Verify reset
echo -e "\n${GREEN}4. Verifying rate limit reset:${NC}"
curl -s -i "$API_URL$ENDPOINT" | sed -n '/^HTTP/p;/^X-RateLimit/p'
