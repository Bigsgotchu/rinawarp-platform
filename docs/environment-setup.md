# Environment Setup Instructions

## Setting Up GitHub Environments

1. Go to your GitHub repository settings
2. Navigate to Settings > Environments
3. Create two new environments:

### Production Environment
1. Click "New environment"
2. Name: `production`
3. Configure protection rules:
   - Required reviewers: Add required team members
   - Deployment branches:
     - Selected branches
     - Add rule: `main`
     - Add rule: `releases/**`
   - Wait timer: 15 minutes
4. Add environment secrets:
   ```
   AWS_ACCESS_KEY_ID=your-prod-key
   AWS_SECRET_ACCESS_KEY=your-prod-secret
   ```

### Staging Environment
1. Click "New environment"
2. Name: `staging`
3. Configure protection rules:
   - Deployment branches:
     - Allow all branches
4. Add environment secrets:
   ```
   AWS_ACCESS_KEY_ID=your-staging-key
   AWS_SECRET_ACCESS_KEY=your-staging-secret
   ```

## Security Considerations

- Different AWS credentials for staging and production
- Production requires approval from two team members
- 15-minute wait timer for production deployments
- Only main and release branches can deploy to production
- Staging environment allows feature branch deployments

## Deployment Flow

1. Feature branches deploy to staging automatically
2. Main branch deploys to production after:
   - Required reviews
   - 15-minute wait period
3. Release tags deploy to production after:
   - Required reviews
   - 15-minute wait period

## Best Practices

- Never share credentials between environments
- Use separate AWS roles for staging and production
- Regularly rotate AWS credentials
- Review deployment logs in GitHub Actions
- Monitor deployments in AWS Console
