#!/bin/bash

# Use wrangler to create a new API token
echo "Creating new Cloudflare API token..."
TOKEN_INFO=$(wrangler api-token create \
    --name "RinaWarp API SSL & DNS" \
    --permission "zone:dns:edit" \
    --permission "zone:ssl:edit" \
    --permission "zone:settings:edit" \
    --resource "zone:rinawarptech.com")

# Extract the token from the response
TOKEN=$(echo "$TOKEN_INFO" | grep -o 'Token: [^ ]*' | cut -d' ' -f2)

if [ -z "$TOKEN" ]; then
    echo "Error: Failed to create API token"
    exit 1
fi

# Export the token
export CLOUDFLARE_API_TOKEN="$TOKEN"

echo "API token created and exported as CLOUDFLARE_API_TOKEN"
echo "Now running setup-cloudflare-creds.sh to store credentials in Railway..."

# Run the credentials setup script
./scripts/setup-cloudflare-creds.sh
