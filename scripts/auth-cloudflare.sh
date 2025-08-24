#!/bin/bash

# Colors for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Step 1: Creating API Token${NC}"
echo "Please go to https://dash.cloudflare.com/profile/api-tokens"
echo "Click 'Create Token' and use 'Create Custom Token'"
echo
echo "Configure the token with these permissions:"
echo "- Zone > DNS > Edit"
echo "- Zone > SSL and Certificates > Edit"
echo "- Zone > Zone Settings > Edit"
echo
echo "Under 'Zone Resources', select:"
echo "- Include > Specific zone > rinawarptech.com"
echo
# Check if token is provided as argument
if [ -z "$1" ]; then
    echo "Usage: $0 <cloudflare_api_token>"
    echo "Example: $0 'your_api_token_here'"
    exit 1
fi

API_TOKEN="$1"

# Validate the token
echo -e "\n${YELLOW}Validating API token...${NC}"
VALIDATION=$(curl -s -X GET "https://api.cloudflare.com/client/v4/user/tokens/verify" \
    -H "Authorization: Bearer $API_TOKEN" \
    -H "Content-Type: application/json")

if [ "$(echo $VALIDATION | jq -r '.success')" != "true" ]; then
    echo "❌ Invalid API token"
    echo "Error: $(echo $VALIDATION | jq -r '.errors[0].message')"
    exit 1
fi

echo "✅ API token is valid"

# Get Zone ID
echo -e "\n${YELLOW}Fetching Zone ID for rinawarptech.com...${NC}"
ZONE_INFO=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=rinawarptech.com" \
    -H "Authorization: Bearer $API_TOKEN" \
    -H "Content-Type: application/json")

ZONE_ID=$(echo $ZONE_INFO | jq -r '.result[0].id')

if [ -z "$ZONE_ID" ] || [ "$ZONE_ID" = "null" ]; then
    echo "❌ Could not fetch Zone ID"
    echo "Error: $(echo $ZONE_INFO | jq -r '.errors[0].message')"
    exit 1
fi

echo "✅ Zone ID found"

# Store credentials in Railway
echo -e "\n${YELLOW}Storing credentials in Railway...${NC}"
railway variables set \
    CLOUDFLARE_API_TOKEN="$API_TOKEN" \
    CLOUDFLARE_ZONE_ID="$ZONE_ID"

echo "✅ Credentials stored in Railway"

# Export for current session
export CLOUDFLARE_API_TOKEN="$API_TOKEN"
export CLOUDFLARE_ZONE_ID="$ZONE_ID"

echo -e "\n${GREEN}Authentication complete!${NC}"
echo "You can now run:"
echo "1. ./scripts/configure-cloudflare.sh (to configure settings)"
echo "2. ./scripts/verify-cloudflare.sh (to verify settings)"
