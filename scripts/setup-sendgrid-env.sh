#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Get the API key
echo -e "${YELLOW}Enter your SendGrid API Key (press Enter, paste key, press Enter again):${NC}"
read -e SENDGRID_API_KEY
echo

# Verify the key
echo -e "${YELLOW}Verifying API key...${NC}"
response=$(curl -s -I "https://api.sendgrid.com/v3/scopes" \
  -H "Authorization: Bearer $SENDGRID_API_KEY")

if [[ $response == *"200 OK"* ]]; then
    echo -e "${GREEN}✓ API key verified successfully${NC}"
    
    # Add to environment
    echo -e "\n${YELLOW}Adding API key to environment...${NC}"
    
    # Remove any existing SENDGRID_API_KEY from .env
    if [ -f .env ]; then
        sed -i '' '/^SENDGRID_API_KEY=/d' .env
    fi
    
    # Add new API key
    echo "SENDGRID_API_KEY=$SENDGRID_API_KEY" >> .env
    
    echo -e "${GREEN}✓ API key added to .env file${NC}"
    echo -e "\n${YELLOW}Now you can run the configuration tool:${NC}"
    echo "./scripts/configure-sendgrid.sh"
else
    echo -e "${RED}✗ Invalid API key${NC}"
    echo "Please verify your API key and try again"
fi
