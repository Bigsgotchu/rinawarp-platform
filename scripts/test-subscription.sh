#!/bin/bash

# Colors for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Testing subscription setup...${NC}"

# 1. Test health endpoint
echo -e "\n${YELLOW}Testing health endpoint...${NC}"
HEALTH_RESPONSE=$(curl -s http://localhost:3000/health)
if [[ $HEALTH_RESPONSE == *"\"status\":\"healthy\""* ]]; then
    echo "✅ Health check passed"
else
    echo "❌ Health check failed"
    echo "Response: $HEALTH_RESPONSE"
    exit 1
fi

# 2. Test subscription tiers endpoint
echo -e "\n${YELLOW}Testing subscription tiers endpoint...${NC}"
TIERS_RESPONSE=$(curl -s http://localhost:3000/api/subscription-tiers)
if [[ $TIERS_RESPONSE == *"error"* ]]; then
    echo "❌ Failed to fetch subscription tiers"
    echo "Response: $TIERS_RESPONSE"
    exit 1
else
    echo "✅ Successfully fetched subscription tiers"
    echo "Available tiers:"
    echo "$TIERS_RESPONSE" | jq '.'
fi

echo -e "\n${GREEN}All tests passed!${NC}"
