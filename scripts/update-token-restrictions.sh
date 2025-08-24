#!/bin/bash

# Colors for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if token is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <api_token>"
    echo "Example: $0 'your_api_token_here'"
    exit 1
fi

API_TOKEN="$1"

# Get current IP
CURRENT_IP=$(curl -s ifconfig.me)
echo -e "${YELLOW}Current IP: $CURRENT_IP${NC}"

# Function to make Cloudflare API calls
cf_api() {
    local method=$1
    local endpoint=$2
    local data=$3
    
    curl -s -X "$method" \
        "https://api.cloudflare.com/client/v4$endpoint" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        ${data:+--data "$data"}
}

# Get token details
echo -e "\n${YELLOW}Fetching token details...${NC}"
TOKEN_INFO=$(cf_api GET "/user/tokens/verify")

if [ "$(echo $TOKEN_INFO | jq -r '.success')" != "true" ]; then
    echo "❌ Invalid API token"
    echo "Error: $(echo $TOKEN_INFO | jq -r '.errors[0].message')"
    exit 1
fi

echo "✅ Token is valid"

# Try to fetch account info to test permissions
echo -e "\n${YELLOW}Testing API access...${NC}"
ACCOUNT_INFO=$(cf_api GET "/user")

if [ "$(echo $ACCOUNT_INFO | jq -r '.success')" != "true" ]; then
    echo "❌ Could not access account info"
    echo "Error: $(echo $ACCOUNT_INFO | jq -r '.errors[0].message')"
    echo "\nPlease create a new token with these exact permissions:"
    echo "  - Zone > Zone > Read"
    echo "  - Zone > DNS > Edit"
    echo "  - Zone > SSL and Certificates > Edit"
    echo "  - Zone > Zone Settings > Edit"
    echo "For: Include > Specific zone > rinawarptech.com"
    echo "Important: Do not set any IP Address restrictions"
    exit 1
fi

echo "✅ API access confirmed"

# Now try to access zone info
ZONE_INFO=$(cf_api GET "/zones?name=rinawarptech.com")

if [ "$(echo $ZONE_INFO | jq -r '.success')" = "true" ] && [ "$(echo $ZONE_INFO | jq -r '.result[0].name')" = "rinawarptech.com" ]; then
    echo "✅ Successfully accessed zone info - token appears to be working"
    
    # Store updated token in Railway and .env.production
    echo -e "\n${YELLOW}Updating environment variables...${NC}"
    railway variables set CLOUDFLARE_API_TOKEN="$API_TOKEN"
    
    # Update .env.production file
    if [ -f ".env.production" ]; then
        sed -i '' 's/^CLOUDFLARE_API_TOKEN=.*/CLOUDFLARE_API_TOKEN='"$API_TOKEN"'/' .env.production
        echo "✅ Updated .env.production with new token"
    else
        echo "⚠️ .env.production file not found"
    fi
    
    echo -e "\n${GREEN}Update complete!${NC}"
    echo "You can now run:"
    echo "./scripts/get-cloudflare-zone.sh"
else
    echo "❌ Failed to update token"
    echo "Error: $(echo $UPDATE_RESPONSE | jq -r '.errors[0].message')"
    exit 1
fi
