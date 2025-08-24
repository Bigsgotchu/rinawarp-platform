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
echo -e "${YELLOW}Verifying token...${NC}"
TOKEN_INFO=$(cf_api GET "/user/tokens/verify")

if [ "$(echo $TOKEN_INFO | jq -r '.success')" != "true" ]; then
    echo "❌ Invalid API token"
    echo "Error: $(echo $TOKEN_INFO | jq -r '.errors[0].message')"
    exit 1
fi

echo "✅ Token is valid"

# Try to fetch zone info
echo -e "\n${YELLOW}Fetching zone info...${NC}"
ZONE_INFO=$(cf_api GET "/zones?name=rinawarptech.com")

if [ "$(echo $ZONE_INFO | jq -r '.success')" = "true" ]; then
    ZONE_ID=$(echo $ZONE_INFO | jq -r '.result[0].id')
    if [ -n "$ZONE_ID" ] && [ "$ZONE_ID" != "null" ]; then
        echo "✅ Successfully accessed zone"
        echo "Zone ID: $ZONE_ID"
        
        # Update Railway and .env.production with both values
        echo -e "\n${YELLOW}Updating environment variables...${NC}"
        railway variables set \
            CLOUDFLARE_API_TOKEN="$API_TOKEN" \
            CLOUDFLARE_ZONE_ID="$ZONE_ID"
            
        # Update .env.production file
        if [ -f ".env.production" ]; then
            sed -i '' "s/^CLOUDFLARE_API_TOKEN=.*/CLOUDFLARE_API_TOKEN=$API_TOKEN/" .env.production
            sed -i '' "s/^CLOUDFLARE_ZONE_ID=.*/CLOUDFLARE_ZONE_ID=$ZONE_ID/" .env.production
            echo "✅ Updated .env.production"
        else
            echo "⚠️ .env.production file not found"
        fi
        
        echo -e "\n${GREEN}Setup complete!${NC}"
        echo "You can now proceed with your deployment"
    else
        echo "❌ Could not find zone for rinawarptech.com"
        echo "Please check that your token has access to this zone"
        exit 1
    fi
else
    echo "❌ Failed to fetch zone info"
    echo "Error: $(echo $ZONE_INFO | jq -r '.errors[0].message')"
    exit 1
fi
