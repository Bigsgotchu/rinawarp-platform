#!/bin/bash

# Check if we have the required variables
if [ -z "$CLOUDFLARE_API_TOKEN" ] || [ -z "$CLOUDFLARE_ZONE_ID" ]; then
    echo "❌ Required environment variables not set."
    echo "Please set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID"
    exit 1
fi

# Base URL for Cloudflare API
API_BASE="https://api.cloudflare.com/client/v4"
AUTH_HEADER="Authorization: Bearer $CLOUDFLARE_API_TOKEN"

# Function to make Cloudflare API calls
cf_api() {
    local endpoint=$1
    curl -s -X GET \
        "$API_BASE$endpoint" \
        -H "$AUTH_HEADER" \
        -H "Content-Type: application/json"
}

# Function to check setting
check_setting() {
    local name=$1
    local endpoint=$2
    local expected=$3
    
    echo -n "Checking $name... "
    local result=$(cf_api "$endpoint" | jq -r '.result.value')
    
    if [ "$result" = "$expected" ]; then
        echo "✅ ($result)"
    else
        echo "❌ (Expected: $expected, Got: $result)"
    fi
}

echo "🔍 Verifying Cloudflare Configuration"
echo "====================================="

# Check SSL/TLS mode
check_setting "SSL/TLS Mode" "/zones/$CLOUDFLARE_ZONE_ID/settings/ssl" "full_strict"

# Check Always Use HTTPS
check_setting "Always Use HTTPS" "/zones/$CLOUDFLARE_ZONE_ID/settings/always_use_https" "on"

# Check Brotli
check_setting "Brotli Compression" "/zones/$CLOUDFLARE_ZONE_ID/settings/brotli" "on"

# Check HTTP/2
check_setting "HTTP/2" "/zones/$CLOUDFLARE_ZONE_ID/settings/http2" "on"

# Check HTTP/3
check_setting "HTTP/3" "/zones/$CLOUDFLARE_ZONE_ID/settings/http3" "on"

# Check Auto Minify
echo -n "Checking Auto Minify... "
MINIFY=$(cf_api "/zones/$CLOUDFLARE_ZONE_ID/settings/minify" | jq -r '.result.value')
if [ "$(echo $MINIFY | jq -r '.css')" = "true" ] && \
   [ "$(echo $MINIFY | jq -r '.html')" = "true" ] && \
   [ "$(echo $MINIFY | jq -r '.js')" = "true" ]; then
    echo "✅ (All enabled)"
else
    echo "❌ (Not all formats enabled)"
fi

# Check CNAME record
echo -n "Checking CNAME record for api.rinawarptech.com... "
DNS_RECORD=$(cf_api "/zones/$CLOUDFLARE_ZONE_ID/dns_records?type=CNAME&name=api.rinawarptech.com")
if [ "$(echo $DNS_RECORD | jq -r '.result[0].content')" = "nu0letsy.up.railway.app" ] && \
   [ "$(echo $DNS_RECORD | jq -r '.result[0].proxied')" = "true" ]; then
    echo "✅ (Points to Railway and is proxied)"
else
    echo "❌ (CNAME record not configured correctly)"
fi

# Check if the API is responding
echo -n "Checking API health endpoint... "
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" https://api.rinawarptech.com/health)
if [ "$HEALTH_CHECK" = "200" ]; then
    echo "✅ (HTTP 200)"
else
    echo "❌ (HTTP $HEALTH_CHECK)"
fi

echo -e "\n📝 SSL Certificate Details:"
echo "=========================="
curl -sI https://api.rinawarptech.com | grep -i "SSL"
