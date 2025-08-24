#!/bin/bash

# Check if the API token is already set
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo "Error: CLOUDFLARE_API_TOKEN is not set"
    exit 1
fi

# Function to make Cloudflare API calls
cf_api() {
    local endpoint=$1
    curl -s -X GET \
        "https://api.cloudflare.com/client/v4$endpoint" \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        -H "Content-Type: application/json"
}

# Get Zone ID for rinawarptech.com
echo "Fetching Zone ID for rinawarptech.com..."
ZONE_INFO=$(cf_api "/zones?name=rinawarptech.com")
ZONE_ID=$(echo $ZONE_INFO | jq -r '.result[0].id')

if [ -z "$ZONE_ID" ] || [ "$ZONE_ID" = "null" ]; then
    echo "Error: Could not fetch Zone ID"
    exit 1
fi

echo "Found Zone ID: $ZONE_ID"

# Store credentials in Railway
echo "Storing credentials in Railway..."
railway variables set \
    CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN" \
    CLOUDFLARE_ZONE_ID="$ZONE_ID"

echo "Credentials stored successfully!"
