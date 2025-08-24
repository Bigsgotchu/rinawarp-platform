#!/bin/bash

# Function to generate a secure random string
generate_secret() {
    openssl rand -base64 32 | tr -d '/+=' | cut -c1-32
}

# Function to check if a variable exists in .env.production
check_env_var() {
    local var_name=$1
    grep -q "^$var_name=" .env.production
    return $?
}

# Create backup of existing .env.production if it exists
if [ -f .env.production ]; then
    cp .env.production ".env.production.backup-$(date +%Y%m%d-%H%M%S)"
fi

# Generate new secrets
JWT_SECRET=$(generate_secret)
JWT_REFRESH_SECRET=$(generate_secret)
COOKIE_SECRET=$(generate_secret)
DB_PASSWORD=$(generate_secret)
REDIS_PASSWORD=$(generate_secret)

# Update environment variables
sed -i.bak "s/{{JWT_SECRET}}/$JWT_SECRET/g" .env.production
sed -i.bak "s/{{JWT_REFRESH_SECRET}}/$JWT_REFRESH_SECRET/g" .env.production
sed -i.bak "s/{{COOKIE_SECRET}}/$COOKIE_SECRET/g" .env.production
sed -i.bak "s/{{DB_PASSWORD}}/$DB_PASSWORD/g" .env.production
sed -i.bak "s/{{REDIS_PASSWORD}}/$REDIS_PASSWORD/g" .env.production

# Remove backup files
rm -f .env.production.bak

echo "Environment variables have been securely generated and updated!"
echo "Please make sure to securely store the following values:"
echo "---"
echo "JWT_SECRET=$JWT_SECRET"
echo "JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET"
echo "COOKIE_SECRET=$COOKIE_SECRET"
echo "DB_PASSWORD=$DB_PASSWORD"
echo "REDIS_PASSWORD=$REDIS_PASSWORD"
echo "---"
echo "These values have been automatically updated in .env.production"
echo "A backup of the original file has been created"
