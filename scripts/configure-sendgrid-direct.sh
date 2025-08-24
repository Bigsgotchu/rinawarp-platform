#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Load API key from .env
if [ -f .env ]; then
    export $(cat .env | grep SENDGRID_API_KEY)
fi

if [ -z "$SENDGRID_API_KEY" ]; then
    echo -e "${RED}Error: SENDGRID_API_KEY not found in .env file${NC}"
    exit 1
fi

# Step 1: Create Unsubscribe Groups
echo -e "${YELLOW}Creating unsubscribe groups...${NC}"

groups=("Alerts" "Weekly Reports" "Monthly Reports")
for group in "${groups[@]}"; do
    echo -e "\nCreating group: $group"
    response=$(curl -s -X POST "https://api.sendgrid.com/v3/asm/groups" \
        -H "Authorization: Bearer $SENDGRID_API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"name\": \"$group\",
            \"description\": \"$group from RinaWarp Technologies\",
            \"is_default\": false
        }")
    
    if [[ $response == *"\"id\":"* ]]; then
        group_id=$(echo "$response" | grep -o '"id":[0-9]*' | cut -d':' -f2)
        echo -e "${GREEN}✓ Created group: $group (ID: $group_id)${NC}"
    else
        echo -e "${RED}✗ Failed to create group: $group${NC}"
        echo "$response"
    fi
done

# Step 2: Configure Event Webhook
echo -e "\n${YELLOW}Configuring event webhook...${NC}"

response=$(curl -s -X POST "https://api.sendgrid.com/v3/user/webhooks/event/settings" \
    -H "Authorization: Bearer $SENDGRID_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
        "enabled": true,
        "url": "https://api.rinawarptech.com/api/webhooks/sendgrid",
        "group_resubscribe": false,
        "delivered": false,
        "group_unsubscribe": true,
        "spam_report": true,
        "bounce": true,
        "deferred": false,
        "unsubscribe": true,
        "processed": false,
        "open": true,
        "click": true,
        "dropped": false
    }')

if [[ $response == *"\"enabled\":true"* ]]; then
    echo -e "${GREEN}✓ Event webhook configured${NC}"
else
    echo -e "${RED}✗ Failed to configure event webhook${NC}"
    echo "$response"
fi

# Step 3: Enable Email Settings
echo -e "\n${YELLOW}Configuring email settings...${NC}"

response=$(curl -s -X PATCH "https://api.sendgrid.com/v3/user/settings/tracking" \
    -H "Authorization: Bearer $SENDGRID_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
        "click_tracking": {
            "enabled": true,
            "enable_text": true
        },
        "open_tracking": {
            "enabled": true
        },
        "subscription_tracking": {
            "enabled": true,
            "html_content": "<p>If you would like to unsubscribe and stop receiving these emails <% click here %>.</p>",
            "plain_content": "If you would like to unsubscribe and stop receiving these emails, visit: <% %>.",
            "replace_tag": "[unsubscribe_tag]"
        }
    }')

if [[ $response == *"\"subscription_tracking\":{\"enabled\":true"* ]]; then
    echo -e "${GREEN}✓ Email settings configured${NC}"
else
    echo -e "${RED}✗ Failed to configure email settings${NC}"
    echo "$response"
fi

# Verify Configuration
echo -e "\n${YELLOW}Verifying configuration...${NC}"

# Check webhook
echo -e "\n${BLUE}Event Webhook:${NC}"
curl -s "https://api.sendgrid.com/v3/user/webhooks/event/settings" \
    -H "Authorization: Bearer $SENDGRID_API_KEY" | json_pp

# Check groups
echo -e "\n${BLUE}Unsubscribe Groups:${NC}"
curl -s "https://api.sendgrid.com/v3/asm/groups" \
    -H "Authorization: Bearer $SENDGRID_API_KEY" | json_pp

# Check tracking settings
echo -e "\n${BLUE}Email Settings:${NC}"
curl -s "https://api.sendgrid.com/v3/user/settings/tracking" \
    -H "Authorization: Bearer $SENDGRID_API_KEY" | json_pp

echo -e "\n${GREEN}Configuration complete!${NC}"
