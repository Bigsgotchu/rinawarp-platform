#!/bin/bash

# Exit on error
set -e

# Function to generate a secure random string
generate_secret() {
    openssl rand -base64 32
}

# Check for required tools
command -v aws >/dev/null 2>&1 || { echo "AWS CLI is required but not installed. Aborting." >&2; exit 1; }
command -v terraform >/dev/null 2>&1 || { echo "Terraform is required but not installed. Aborting." >&2; exit 1; }

# Setup AWS credentials
if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
    echo "Setting up AWS credentials..."
    aws configure
fi

# Create S3 bucket for Terraform state if it doesn't exist
aws s3api create-bucket \
    --bucket rinawarp-terraform-state \
    --region us-east-1 \
    2>/dev/null || true

# Enable versioning on the bucket
aws s3api put-bucket-versioning \
    --bucket rinawarp-terraform-state \
    --versioning-configuration Status=Enabled

# Generate secrets
JWT_SECRET=$(generate_secret)
JWT_REFRESH_SECRET=$(generate_secret)
COOKIE_SECRET=$(generate_secret)
SESSION_SECRET=$(generate_secret)
DB_PASSWORD=$(generate_secret)
REDIS_PASSWORD=$(generate_secret)

# Create environment file from template
echo "Creating production environment file..."
cp .env.production.template .env.production

# Update environment file with generated secrets
sed -i '' "s/{{GENERATED_JWT_SECRET}}/$JWT_SECRET/g" .env.production
sed -i '' "s/{{GENERATED_REFRESH_SECRET}}/$JWT_REFRESH_SECRET/g" .env.production
sed -i '' "s/{{GENERATED_COOKIE_SECRET}}/$COOKIE_SECRET/g" .env.production
sed -i '' "s/{{GENERATED_SESSION_SECRET}}/$SESSION_SECRET/g" .env.production

# Store secrets in AWS Secrets Manager
echo "Storing secrets in AWS Secrets Manager..."
aws secretsmanager create-secret \
    --name "rinawarp/prod/db-password" \
    --secret-string "$DB_PASSWORD" \
    --region us-east-1

aws secretsmanager create-secret \
    --name "rinawarp/prod/redis-password" \
    --secret-string "$REDIS_PASSWORD" \
    --region us-east-1

# Initialize and apply Terraform
echo "Initializing Terraform..."
cd terraform
terraform init

# Export necessary Terraform variables
export TF_VAR_db_password="$DB_PASSWORD"

echo "Applying Terraform configuration..."
terraform apply -auto-approve

# Get infrastructure outputs
DB_ENDPOINT=$(terraform output -raw rds_endpoint)
REDIS_ENDPOINT=$(terraform output -raw redis_endpoint)

# Update environment file with infrastructure details
cd ..
sed -i '' "s/{{RDS_ENDPOINT}}/$DB_ENDPOINT/g" .env.production
sed -i '' "s/{{ELASTICACHE_ENDPOINT}}/$REDIS_ENDPOINT/g" .env.production
sed -i '' "s/{{REDIS_PASSWORD}}/$REDIS_PASSWORD/g" .env.production

# Run database migrations
echo "Running database migrations..."
DATABASE_URL="postgresql://rinawarp_admin:$DB_PASSWORD@$DB_ENDPOINT:5432/rinawarp" npm run db:migrate

echo "Production environment setup complete!"
echo
echo "Next steps:"
echo "1. Update DNS settings for your domain"
echo "2. Configure SSL certificate"
echo "3. Set up monitoring and alerts"
echo "4. Configure any remaining environment variables in .env.production"
echo "5. Deploy the application using 'npm run deploy:prod'"
