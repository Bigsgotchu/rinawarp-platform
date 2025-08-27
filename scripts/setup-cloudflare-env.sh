#!/bin/bash

# Add your token to your shell's environment
echo 'export CLOUDFLARE_API_TOKEN={{your_new_token}}' >> ~/.zshrc

# Also add your zone ID 
echo 'export CLOUDFLARE_ZONE_ID={{your_zone_id}}' >> ~/.zshrc

# Reload your shell configuration
source ~/.zshrc
