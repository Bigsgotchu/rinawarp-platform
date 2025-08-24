#!/bin/bash
# Read all lines except STRIPE_SECRET_KEY
grep -v "STRIPE_SECRET_KEY" .env.production > .env.production.tmp
# Add the correct STRIPE_SECRET_KEY at the end
echo "STRIPE_SECRET_KEY=sk_6217333f4f08dd85a06bd85b337d40c56e6193c195348f8a" >> .env.production.tmp
# Replace the original file
mv .env.production.tmp .env.production
