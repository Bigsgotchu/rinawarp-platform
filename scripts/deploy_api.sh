#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}Deploying API server to Railway...${NC}"

# Switch to the API directory
cd packages/api

# Build the package
echo -e "\n${YELLOW}Building package...${NC}"
npm run build

# Link to Railway project
echo -e "\n${YELLOW}Linking to Railway project...${NC}"
railway link

# Deploy to Railway
echo -e "\n${YELLOW}Deploying to Railway...${NC}"
railway up

echo -e "\n${GREEN}Deployment complete!${NC}"

# Get the deployment URL
echo -e "\n${YELLOW}Getting deployment URL...${NC}"
railway domain

echo -e "\n${GREEN}API deployment finished!${NC}"
