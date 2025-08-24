#!/bin/bash

# SendGrid API Key - DO NOT COMMIT THIS VALUE
SENDGRID_API_KEY="SG.your_sendgrid_key_here"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Webhook Configuration
WEBHOOK_URL="https://api.rinawarptech.com/api/webhooks/sendgrid"
EVENTS=("bounce" "spam_report" "unsubscribe" "group_unsubscribe")

echo -e "${YELLOW}Configuring SendGrid Event Webhook...${NC}"

# Setup Event Webhook
response=$(curl -s -X PATCH "https://api.sendgrid.com/v3/user/webhooks/event/settings" \
  -H "Authorization: Bearer $SENDGRID_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"enabled\": true,
    \"url\": \"$WEBHOOK_URL\",
    \"group_resubscribe\": false,
    \"delivered\": false,
    \"group_unsubscribe\": true,
    \"spam_report\": true,
    \"bounce\": true,
    \"deferred\": false,
    \"unsubscribe\": true,
    \"processed\": false,
    \"open\": true,
    \"click\": true,
    \"dropped\": false
  }")

if echo "$response" | grep -q "success"; then
  echo -e "${GREEN}✓ Event webhook configured successfully${NC}"
else
  echo -e "${RED}✗ Failed to configure event webhook${NC}"
  echo "$response"
  exit 1
fi

# Enable signed webhook verification
echo -e "\n${YELLOW}Enabling webhook signature verification...${NC}"

response=$(curl -s -X PATCH "https://api.sendgrid.com/v3/user/webhooks/event/settings/signed" \
  -H "Authorization: Bearer $SENDGRID_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"enabled\": true
  }")

if echo "$response" | grep -q "success"; then
  echo -e "${GREEN}✓ Webhook signature verification enabled${NC}"
else
  echo -e "${RED}✗ Failed to enable webhook signature verification${NC}"
  echo "$response"
  exit 1
fi

# Create Unsubscribe Groups
echo -e "\n${YELLOW}Creating unsubscribe groups...${NC}"

groups=("Alerts" "Weekly Reports" "Monthly Reports")
group_ids=()

for group in "${groups[@]}"; do
  echo -e "${YELLOW}Creating group: $group${NC}"
  
  response=$(curl -s -X POST "https://api.sendgrid.com/v3/asm/groups" \
    -H "Authorization: Bearer $SENDGRID_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"$group\",
      \"description\": \"$group from RinaWarp Technologies\",
      \"is_default\": false
    }")
  
  if echo "$response" | grep -q "id"; then
    group_id=$(echo "$response" | grep -o '"id":[0-9]*' | cut -d':' -f2)
    group_ids+=($group_id)
    echo -e "${GREEN}✓ Created group: $group (ID: $group_id)${NC}"
  else
    echo -e "${RED}✗ Failed to create group: $group${NC}"
    echo "$response"
    exit 1
  fi
done

# Enable subscription tracking
echo -e "\n${YELLOW}Enabling subscription tracking...${NC}"

response=$(curl -s -X PATCH "https://api.sendgrid.com/v3/user/settings/tracking" \
  -H "Authorization: Bearer $SENDGRID_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"subscription_tracking\": {
      \"enabled\": true,
      \"html_content\": \"<p>If you would like to unsubscribe and stop receiving these emails <% click here %>.</p>\",
      \"plain_content\": \"If you would like to unsubscribe and stop receiving these emails, visit: <% %>.\",
      \"replace_tag\": \"[unsubscribe_tag]\"
    }
  }")

if echo "$response" | grep -q "success"; then
  echo -e "${GREEN}✓ Subscription tracking enabled${NC}"
else
  echo -e "${RED}✗ Failed to enable subscription tracking${NC}"
  echo "$response"
  exit 1
fi

echo -e "\n${GREEN}Setup complete!${NC}"
echo -e "\nGroup IDs for reference:"
for i in "${!groups[@]}"; do
  echo "${groups[$i]}: ${group_ids[$i]}"
done

echo -e "\n${YELLOW}Next steps:${NC}"
echo "1. Store these group IDs in your environment variables"
echo "2. Update your email templates to use the correct group IDs"
echo "3. Test the webhook by sending a test event"
echo "4. Monitor the webhook endpoint for incoming events"
