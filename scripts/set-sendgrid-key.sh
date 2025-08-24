#!/bin/bash

# Remove existing key from .env if it exists
if [ -f .env ]; then
    sed -i '' '/^SENDGRID_API_KEY=/d' .env
fi

# Add new key to .env
echo "SENDGRID_API_KEY=$1" >> .env

# Verify the key works
response=$(curl -s -I "https://api.sendgrid.com/v3/scopes" \
  -H "Authorization: Bearer $1")

if [[ $response == *"200 OK"* ]]; then
    echo "✅ API key verified and saved successfully!"
    echo "Now run: ./scripts/configure-sendgrid.sh"
else
    echo "❌ Error: Invalid API key"
    echo "Response from SendGrid:"
    echo "$response"
fi
