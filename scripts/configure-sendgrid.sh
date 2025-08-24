#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Function to show menu
show_menu() {
    clear
    echo -e "${BLUE}=== SendGrid Configuration Tool ===${NC}\n"
    echo "1) Configure Event Webhook"
    echo "2) Create Unsubscribe Groups"
    echo "3) Enable Subscription Tracking"
    echo "4) View Current Configuration"
    echo "5) Test Webhook"
    echo "q) Quit"
    echo
    echo -e "${YELLOW}Choose an option:${NC}"
}

# Function to prompt for API key
get_api_key() {
    if [ -z "$SENDGRID_API_KEY" ]; then
        echo -e "${YELLOW}Enter your SendGrid API Key:${NC}"
        read -s SENDGRID_API_KEY
        echo
    fi
}

# Configure Event Webhook
configure_webhook() {
    echo -e "\n${YELLOW}Configuring SendGrid Event Webhook...${NC}"
    
    echo -e "${YELLOW}Webhook URL will be: https://api.rinawarptech.com/api/webhooks/sendgrid${NC}"
    echo -e "${YELLOW}Continue? (y/n)${NC}"
    read confirm
    
    if [ "$confirm" != "y" ]; then
        echo -e "${RED}Cancelled${NC}"
        return
    fi

    response=$(curl -s -X PATCH "https://api.sendgrid.com/v3/user/webhooks/event/settings" \
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
        echo -e "${GREEN}✓ Webhook configured successfully${NC}"
        
        # Enable webhook signing
        echo -e "\n${YELLOW}Enabling webhook signature verification...${NC}"
        
        response=$(curl -s -X PATCH "https://api.sendgrid.com/v3/user/webhooks/event/settings/signed" \
            -H "Authorization: Bearer $SENDGRID_API_KEY" \
            -H "Content-Type: application/json" \
            -d '{
                "enabled": true
            }')

        if [[ $response == *"\"enabled\":true"* ]]; then
            echo -e "${GREEN}✓ Webhook signing enabled${NC}"
            
            # Get and display the signing key
            key_response=$(curl -s "https://api.sendgrid.com/v3/user/webhooks/event/settings/signed" \
                -H "Authorization: Bearer $SENDGRID_API_KEY")
            
            public_key=$(echo "$key_response" | grep -o '"public_key":"[^"]*' | cut -d'"' -f4)
            echo -e "\n${YELLOW}Webhook Public Key (save this):${NC}"
            echo "$public_key"
        else
            echo -e "${RED}✗ Failed to enable webhook signing${NC}"
        fi
    else
        echo -e "${RED}✗ Failed to configure webhook${NC}"
        echo "$response"
    fi
    
    echo -e "\nPress any key to continue..."
    read -n 1
}

# Create Unsubscribe Groups
create_groups() {
    echo -e "\n${YELLOW}Creating unsubscribe groups...${NC}"
    
    groups=("Alerts" "Weekly Reports" "Monthly Reports")
    
    for group in "${groups[@]}"; do
        echo -e "\n${YELLOW}Creating group: $group${NC}"
        
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
    
    echo -e "\nPress any key to continue..."
    read -n 1
}

# Enable Subscription Tracking
enable_tracking() {
    echo -e "\n${YELLOW}Enabling subscription tracking...${NC}"
    
    response=$(curl -s -X PATCH "https://api.sendgrid.com/v3/user/settings/tracking" \
        -H "Authorization: Bearer $SENDGRID_API_KEY" \
        -H "Content-Type: application/json" \
        -d '{
            "subscription_tracking": {
                "enabled": true,
                "html_content": "<p>If you would like to unsubscribe and stop receiving these emails <% click here %>.</p>",
                "plain_content": "If you would like to unsubscribe and stop receiving these emails, visit: <% %>.",
                "replace_tag": "[unsubscribe_tag]"
            }
        }')

    if [[ $response == *"\"subscription_tracking\":{\"enabled\":true"* ]]; then
        echo -e "${GREEN}✓ Subscription tracking enabled${NC}"
    else
        echo -e "${RED}✗ Failed to enable subscription tracking${NC}"
        echo "$response"
    fi
    
    echo -e "\nPress any key to continue..."
    read -n 1
}

# View Current Configuration
view_config() {
    echo -e "\n${YELLOW}Current Configuration:${NC}\n"
    
    # Get webhook settings
    echo -e "${BLUE}Event Webhook:${NC}"
    curl -s "https://api.sendgrid.com/v3/user/webhooks/event/settings" \
        -H "Authorization: Bearer $SENDGRID_API_KEY" | json_pp
    
    echo -e "\n${BLUE}Unsubscribe Groups:${NC}"
    curl -s "https://api.sendgrid.com/v3/asm/groups" \
        -H "Authorization: Bearer $SENDGRID_API_KEY" | json_pp
    
    echo -e "\n${BLUE}Subscription Tracking:${NC}"
    curl -s "https://api.sendgrid.com/v3/user/settings/tracking" \
        -H "Authorization: Bearer $SENDGRID_API_KEY" | json_pp
    
    echo -e "\nPress any key to continue..."
    read -n 1
}

# Test Webhook
test_webhook() {
    echo -e "\n${YELLOW}Sending test event to webhook...${NC}"
    
    # Get webhook URL
    webhook_url=$(curl -s "https://api.sendgrid.com/v3/user/webhooks/event/settings" \
        -H "Authorization: Bearer $SENDGRID_API_KEY" | grep -o '"url":"[^"]*' | cut -d'"' -f4)
    
    if [ -z "$webhook_url" ]; then
        echo -e "${RED}✗ No webhook URL configured${NC}"
        echo -e "\nPress any key to continue..."
        read -n 1
        return
    fi
    
    # Send test event
    response=$(curl -s -X POST "$webhook_url" \
        -H "Content-Type: application/json" \
        -d '[{
            "email": "test@rinawarptech.com",
            "timestamp": 1625097600,
            "event": "processed",
            "category": ["test"]
        }]')
    
    echo -e "\n${GREEN}Test event sent to: $webhook_url${NC}"
    echo -e "Response: $response"
    
    echo -e "\nPress any key to continue..."
    read -n 1
}

# Main loop
while true; do
    show_menu
    read -n 1 option
    echo
    
    case $option in
        1)
            get_api_key
            configure_webhook
            ;;
        2)
            get_api_key
            create_groups
            ;;
        3)
            get_api_key
            enable_tracking
            ;;
        4)
            get_api_key
            view_config
            ;;
        5)
            get_api_key
            test_webhook
            ;;
        q|Q)
            echo -e "\n${GREEN}Goodbye!${NC}"
            exit 0
            ;;
        *)
            echo -e "\n${RED}Invalid option${NC}"
            sleep 1
            ;;
    esac
done
