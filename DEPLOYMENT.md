# Deployment Guide

This document outlines the process for building and deploying the Rinawarp Platform.

## Prerequisites

- Docker installed and configured
- AWS CLI installed and configured with appropriate credentials
- Access to the AWS ECR repository: `720237151757.dkr.ecr.us-west-2.amazonaws.com/rinawarp`

## Building the Container

1. Build the container locally:
   ```bash
   docker build -t rinawarp-platform .
   ```

2. Tag the container for ECR:
   ```bash
   docker tag rinawarp-platform 720237151757.dkr.ecr.us-west-2.amazonaws.com/rinawarp:<tag>
   ```
   Replace `<tag>` with an appropriate version (e.g., date-based tag like `YYYYMMDD-HHMM`)

3. Authenticate with ECR:
   ```bash
   aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin 720237151757.dkr.ecr.us-west-2.amazonaws.com
   ```

4. Push to ECR:
   ```bash
   docker push 720237151757.dkr.ecr.us-west-2.amazonaws.com/rinawarp:<tag>
   ```

## Deploying to ECS

1. Update the ECS task definition:
   ```bash
   aws ecs register-task-definition --cli-input-json file://task-definition.json
   ```

2. Update the ECS service:
   ```bash
   aws ecs update-service \
     --cluster rinawarp-cluster \
     --service rinawarp \
     --task-definition rinawarp:<revision> \
     --force-new-deployment \
     --region us-west-2
   ```

3. Monitor the deployment:
   ```bash
   # Check service status
   aws ecs describe-services \
     --cluster rinawarp-cluster \
     --services rinawarp \
     --region us-west-2

   # Check target group health
   aws elbv2 describe-target-health \
     --target-group-arn arn:aws:elasticloadbalancing:us-west-2:720237151757:targetgroup/rinawarp-target/93c5afc7242afce3 \
     --region us-west-2
   ```

## Container Architecture

The container is built with the following considerations:

- Uses Node.js 20 Alpine as the base image for minimal size
- Builds TypeScript code during container build
- Runs compiled JavaScript in production (not ts-node)
- Includes Prisma client generation
- Exposes port 3000 for the API

## Environment Variables

The following environment variables must be set:

- `NODE_ENV`: Set to "production" for deployment
- `PORT`: Default is 3000
- `STRIPE_SECRET_KEY`: For payment processing
- `JWT_SECRET`: For authentication
- Additional variables as defined in `.env.example`

## Version Control

After successful deployment, tag the corresponding Git commit:
```bash
git tag -a v<version> -m "Deployment <details>"
git push origin v<version>
```

## Monitoring

- CloudWatch Logs: `/ecs/rinawarp`
- ALB Target Group Health
- ECS Service Metrics

## Rollback Procedure

If issues are detected:

1. Identify the last known good task definition:
   ```bash
   aws ecs list-task-definitions --family-prefix rinawarp --status ACTIVE --region us-west-2
   ```

2. Update the service to use the previous task definition:
   ```bash
   aws ecs update-service \
     --cluster rinawarp-cluster \
     --service rinawarp \
     --task-definition rinawarp:<previous-revision> \
     --force-new-deployment \
     --region us-west-2
   ```

## CI/CD Pipeline

The application uses GitHub Actions for automated deployment to ECS. The pipeline is triggered on:
- Push to main branch
- Release tags (v*)

### Pipeline Steps
1. Build and test application
2. Build Docker image
3. Push to ECR
4. Deploy to ECS
5. Verify deployment

### Required Secrets
Add these secrets to your GitHub repository:
- `AWS_ACCESS_KEY_ID`: AWS access key for ECR/ECS access
- `AWS_SECRET_ACCESS_KEY`: AWS secret key for ECR/ECS access
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook signing secret

## Stripe Integration

### Webhook Configuration
1. Set up webhook endpoint in Stripe Dashboard:
   - URL: `https://your-domain.com/api/webhooks/stripe`
   - Events to listen for:
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`

2. Add the webhook secret to ECS task definition environment variables:
   ```json
   {
     "name": "STRIPE_WEBHOOK_SECRET",
     "value": "your_webhook_secret"
   }
   ```

### Event Handling
The application handles the following Stripe events:
- Subscription lifecycle (created, updated, cancelled)
- Payment processing (succeeded, failed)
- Customer portal sessions

## Security Notes

- ECR repository requires authentication
- Ensure all secrets are properly configured in ECS task definitions
- Use IAM roles with minimum required permissions
- Keep Node.js and dependencies updated
- Validate Stripe webhook signatures
- Use environment variables for sensitive data
