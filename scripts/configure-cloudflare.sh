#!/bin/bash

# Check if required environment variables are set
if [ -z "$CLOUDFLARE_API_TOKEN" ] || [ -z "$CLOUDFLARE_ZONE_ID" ]; then
    echo "Error: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID must be set"
    exit 1
fi

# Base URL for Cloudflare API
API_BASE="https://api.cloudflare.com/client/v4"
AUTH_HEADER="Authorization: Bearer $CLOUDFLARE_API_TOKEN"
ZONE_ID="$CLOUDFLARE_ZONE_ID"

# Function to make Cloudflare API calls
cf_api() {
    local method=$1
    local endpoint=$2
    local data=$3
    
    if [ -n "$data" ]; then
        curl -s -X "$method" \
            "$API_BASE$endpoint" \
            -H "$AUTH_HEADER" \
            -H "Content-Type: application/json" \
            --data "$data"
    else
        curl -s -X "$method" \
            "$API_BASE$endpoint" \
            -H "$AUTH_HEADER" \
            -H "Content-Type: application/json"
    fi
}

echo "Configuring Cloudflare settings for rinawarptech.com..."

# 1. Set SSL/TLS encryption mode to "Full (strict)"
echo "Setting SSL/TLS mode to Full (strict)..."
cf_api PATCH "/zones/$ZONE_ID/settings/ssl" '{"value":"full_strict"}'

# 2. Enable Always Use HTTPS
echo "Enabling Always Use HTTPS..."
cf_api PATCH "/zones/$ZONE_ID/settings/always_use_https" '{"value":"on"}'

# 3. Enable Auto Minify
echo "Enabling Auto Minify..."
cf_api PATCH "/zones/$ZONE_ID/settings/minify" '{"value":{"css":true,"html":true,"js":true}}'

# 4. Enable Brotli compression
echo "Enabling Brotli compression..."
cf_api PATCH "/zones/$ZONE_ID/settings/brotli" '{"value":"on"}'

# 5. Enable HTTP/2
echo "Enabling HTTP/2..."
cf_api PATCH "/zones/$ZONE_ID/settings/http2" '{"value":"on"}'

# 6. Enable HTTP/3
echo "Enabling HTTP/3..."
cf_api PATCH "/zones/$ZONE_ID/settings/http3" '{"value":"on"}'

# Add CNAME record for api subdomain
echo "Adding CNAME record for api.rinawarptech.com..."
cf_api POST "/zones/$ZONE_ID/dns_records" '{
    "type": "CNAME",
    "name": "api",
    "content": "nu0letsy.up.railway.app",
    "proxied": true,
    "ttl": 1
}'

echo "Configuration complete! Please allow a few minutes for changes to propagate."
echo "You can now test the API at https://api.rinawarptech.com/health"
