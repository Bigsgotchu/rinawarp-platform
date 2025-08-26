# RinaWarp Deployment Guide

## Overview

RinaWarp consists of two main components:
1. RinaWarp Platform (Backend API)
2. RinaWarp Desktop Application

This guide covers the deployment process for both components.

## RinaWarp Platform Deployment

### Prerequisites

- Access to AWS Account with ECS and ECR configured
- Kubernetes cluster with:
  - NGINX Ingress Controller
  - Cert-Manager
  - Prometheus Operator (for monitoring)
- Docker installed locally
- kubectl configured with cluster access

### Environment Setup

1. Configure environment variables in AWS Systems Manager Parameter Store:
   ```bash
   aws ssm put-parameter --name "/rinawarp/prod/DATABASE_URL" --type "SecureString" --value "your-value"
   aws ssm put-parameter --name "/rinawarp/prod/REDIS_URL" --type "SecureString" --value "your-value"
   # Add other necessary environment variables
   ```

2. Create necessary secrets in Kubernetes:
   ```bash
   kubectl create secret generic platform-secrets \
     --namespace rinawarp \
     --from-literal=DATABASE_URL=your-value \
     --from-literal=REDIS_URL=your-value
   ```

### Deployment Process

1. Build and push Docker images:
   ```bash
   docker-compose -f docker-compose.prod.yml build
   docker-compose -f docker-compose.prod.yml push
   ```

2. Deploy to Kubernetes:
   ```bash
   # Apply staging manifests
   kubectl apply -f k8s/staging/

   # Apply production manifests
   kubectl apply -f k8s/production/
   ```

3. Verify deployment:
   ```bash
   kubectl get pods -n rinawarp
   kubectl get ingress -n rinawarp
   ```

### Monitoring

- Metrics are available at `https://api.rinawarptech.com/metrics`
- Grafana dashboards are pre-configured for monitoring
- Prometheus alerts will notify the team via Slack

## RinaWarp Desktop Deployment

### Prerequisites

- GitHub repository access
- Code signing certificates for macOS and Windows
- Apple Developer ID for notarization

### Build Configuration

The desktop app build configuration is managed through `electron-builder.yml`, supporting:
- macOS (DMG, ZIP)
- Windows (NSIS Installer, Portable)
- Linux (AppImage, DEB, RPM)

### Release Process

1. Update version in `packages/rinawarp-desktop/package.json`

2. Create a new release tag:
   ```bash
   git tag -a v1.0.0 -m "Release v1.0.0"
   git push origin v1.0.0
   ```

3. The GitHub Actions workflow will:
   - Build applications for all platforms
   - Create GitHub release with artifacts
   - Notify team via Slack

### Distribution

Desktop applications are distributed through:
1. Direct download from rinawarptech.com
2. GitHub Releases
3. App stores (coming soon)

## Troubleshooting

### Platform Issues

1. Check container logs:
   ```bash
   kubectl logs -n rinawarp deployment/platform
   ```

2. Verify service health:
   ```bash
   kubectl describe service platform -n rinawarp
   ```

### Desktop App Issues

1. Check build logs in GitHub Actions
2. Verify code signing in the built artifacts
3. Test the application on each supported platform

## Security Considerations

- All production deployments use TLS
- Secrets are managed through AWS Systems Manager and Kubernetes Secrets
- Regular security scanning through Snyk and CodeQL
- Automated backup system for database

## Backup and Recovery

- Automated backups run daily
- Backups are encrypted and stored in S3
- Retention period: 30 days

## Release Schedule

- Platform updates: Continuous deployment to staging, weekly to production
- Desktop app: Monthly releases with security updates as needed

## Contact

For deployment issues:
- Slack: #rinawarp-ops
- Email: ops@rinawarptech.com
