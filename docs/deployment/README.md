# RinaWarp Platform Deployment Guide

This guide details the steps required to deploy RinaWarp Platform to production environments.

## Deployment Architecture

RinaWarp Platform is deployed using a containerized architecture with the following components:

- Node.js application containers
- PostgreSQL database
- Redis cache
- NGINX reverse proxy
- Let's Encrypt for SSL
- Monitoring stack (Prometheus + Grafana)

## Prerequisites

- Docker and Docker Compose
- AWS CLI configured with appropriate credentials
- kubectl configured with access to your Kubernetes cluster
- Terraform (optional, for infrastructure provisioning)

## Environment Setup

1. Create necessary environment variables in `.env.production`:

```bash
# Application
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
API_URL=https://api.rinawarptech.com
WEBSITE_URL=https://rinawarptech.com

# Authentication
JWT_SECRET=your-secure-jwt-secret
JWT_EXPIRATION=24h
SESSION_SECRET=your-secure-session-secret

# Database
DATABASE_URL=postgresql://user:password@postgres:5432/rinawarp
REDIS_URL=redis://redis:6379

# AI Service
AI_SERVICE_URL=https://ai.rinawarptech.com
AI_API_KEY=your-ai-service-key

# Stripe
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret
STRIPE_PRO_MONTHLY_PRICE_ID=price_xxx
STRIPE_PRO_YEARLY_PRICE_ID=price_xxx
STRIPE_TURBO_MONTHLY_PRICE_ID=price_xxx
STRIPE_TURBO_YEARLY_PRICE_ID=price_xxx
STRIPE_BUSINESS_MONTHLY_PRICE_ID=price_xxx
STRIPE_BUSINESS_YEARLY_PRICE_ID=price_xxx

# Monitoring
SENTRY_DSN=your-sentry-dsn
METRICS_INTERVAL=60000
METRICS_RETENTION=86400
```

2. Configure SSL certificates:

```bash
# Generate certificates using certbot
certbot certonly --standalone -d api.rinawarptech.com
certbot certonly --standalone -d rinawarptech.com
```

## Deployment Steps

1. Build and push Docker images:

```bash
# Build images
docker build -t rinawarptech/platform:latest -f Dockerfile .
docker build -t rinawarptech/website:latest -f Dockerfile.website ../rinawarptech-website

# Push to registry
docker push rinawarptech/platform:latest
docker push rinawarptech/website:latest
```

2. Apply Kubernetes configurations:

```bash
# Create namespace
kubectl create namespace rinawarp

# Apply configs
kubectl apply -f k8s/production/
```

3. Initialize database:

```bash
# Run migrations
kubectl exec -n rinawarp deployment/platform -- npm run db:migrate

# Seed initial data
kubectl exec -n rinawarp deployment/platform -- npm run db:seed
```

4. Configure monitoring:

```bash
# Install monitoring stack
helm install monitoring prometheus-community/kube-prometheus-stack -n monitoring

# Apply custom dashboards
kubectl apply -f k8s/monitoring/dashboards/
```

## Infrastructure Configuration

### AWS Infrastructure (using Terraform)

1. Initialize Terraform:

```bash
cd terraform
terraform init
```

2. Plan and apply infrastructure:

```bash
terraform plan -var-file=production.tfvars
terraform apply -var-file=production.tfvars
```

### Kubernetes Configuration

Key Kubernetes resources:

1. Deployments:
   - Platform API
   - Website
   - PostgreSQL
   - Redis
   - NGINX Ingress

2. Services:
   - Platform API LoadBalancer
   - Website LoadBalancer
   - Database ClusterIP
   - Redis ClusterIP

3. ConfigMaps and Secrets:
   - Application configuration
   - Database credentials
   - SSL certificates
   - API keys

## Monitoring & Logging

1. Metrics collection:
   - Application metrics via Prometheus
   - System metrics via node_exporter
   - PostgreSQL metrics via postgres_exporter
   - Redis metrics via redis_exporter

2. Logging:
   - Application logs to stdout/stderr
   - Log aggregation via fluentd
   - Log storage in Elasticsearch
   - Log visualization in Kibana

3. Alerting:
   - Prometheus Alert Manager for metrics-based alerts
   - Sentry for error tracking
   - PagerDuty integration for on-call notification

## Scaling Configuration

1. Horizontal Pod Autoscaling:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: platform-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: platform
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 80
```

2. Redis caching configuration:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: redis-config
data:
  redis.conf: |
    maxmemory 2gb
    maxmemory-policy allkeys-lru
    appendonly yes
```

## Backup & Recovery

1. Database backups:
   - Automated daily backups to S3
   - Point-in-time recovery enabled
   - Retention period: 30 days

2. Redis persistence:
   - AOF persistence enabled
   - Regular RDB snapshots
   - Backup to S3 every 6 hours

## Security Configuration

1. Network policies:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: platform-network-policy
spec:
  podSelector:
    matchLabels:
      app: platform
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: database
    ports:
    - protocol: TCP
      port: 5432
```

2. Pod security policies:
   - Non-root user
   - Read-only root filesystem
   - No privileged containers
   - Limited capabilities

## Rollback Procedures

In case of deployment issues:

1. Immediate rollback:
```bash
kubectl rollout undo deployment/platform -n rinawarp
```

2. Rollback to specific version:
```bash
kubectl rollout undo deployment/platform -n rinawarp --to-revision=<revision_number>
```

## Maintenance Procedures

1. Database maintenance:
```bash
# Run vacuum
kubectl exec -n rinawarp deployment/postgres -- psql -U postgres -c "VACUUM ANALYZE;"

# Check table sizes
kubectl exec -n rinawarp deployment/postgres -- psql -U postgres -c "\d+"
```

2. Log rotation:
```bash
# Configure logrotate
kubectl apply -f k8s/production/logrotate-config.yaml
```

## Troubleshooting

Common issues and solutions:

1. Database connection issues:
   - Check network policies
   - Verify credentials in secrets
   - Check PostgreSQL logs

2. High memory usage:
   - Review Redis cache configuration
   - Check for memory leaks in Node.js
   - Adjust container resource limits

3. High CPU usage:
   - Review Node.js profiling
   - Check for expensive queries
   - Adjust HPA settings

4. Certificate issues:
   - Verify Let's Encrypt renewal
   - Check cert-manager logs
   - Manually renew if needed

## Production Checklist

Before deploying:

- [ ] All environment variables configured
- [ ] SSL certificates installed
- [ ] Database migrations tested
- [ ] Monitoring configured
- [ ] Backup system verified
- [ ] Security policies applied
- [ ] Load testing completed
- [ ] Documentation updated

After deploying:

- [ ] Verify application health
- [ ] Check monitoring dashboards
- [ ] Validate SSL certificates
- [ ] Test key functionality
- [ ] Monitor error rates
- [ ] Verify backup system
- [ ] Test alerting system
