#!/bin/bash

# Function to make request and show response
make_request() {
    curl -v http://localhost:3000/api/subscription-tiers \
        -H "Content-Type: application/json" \
        2>&1 | grep -i 'HTTP\|x-rate'
    echo "---"
}

echo "Testing rate limits..."
echo "Making 5 requests in quick succession:"
echo

for i in {1..5}; do
    echo "Request $i:"
    make_request
    sleep 1
done

echo "Now making 50 requests quickly to trigger rate limit:"
for i in {1..50}; do
    response=$(curl -s -w "\nHTTP_STATUS=%{http_code}" http://localhost:3000/api/subscription-tiers \
        -H "Content-Type: application/json" \
        2>/dev/null)
    status=$(echo "$response" | grep "HTTP_STATUS" | cut -d= -f2)
    
    if [ "$status" == "429" ]; then
        echo "Rate limit hit at request $i"
        echo "Response: $response"
        break
    fi
    
    # No delay to hit rate limit faster
done
