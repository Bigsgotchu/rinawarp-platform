#!/bin/bash
set -e

echo "🚀 Deploying Performance Testing Environment"
echo "----------------------------------------"

# Step 1: Apply Terraform Configuration
echo "📦 Applying infrastructure configuration..."
cd ../infrastructure/terraform
terraform apply perf.tfplan

# Step 2: Configure kubectl for the new cluster
echo "⚙️  Configuring kubectl..."
aws eks update-kubeconfig --name rinawarp-perf --region us-west-2

# Step 3: Install monitoring stack
echo "📊 Installing monitoring stack..."
kubectl create namespace monitoring
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Install Prometheus
helm upgrade --install prometheus prometheus-community/prometheus \
  --namespace monitoring \
  --values - <<EOF
server:
  retention: 15d
  persistentVolume:
    size: 50Gi
  resources:
    requests:
      cpu: 500m
      memory: 2Gi
    limits:
      cpu: 1000m
      memory: 4Gi
alertmanager:
  enabled: true
  persistence:
    enabled: true
    size: 10Gi
EOF

# Install Grafana
helm upgrade --install grafana grafana/grafana \
  --namespace monitoring \
  --values - <<EOF
persistence:
  enabled: true
  size: 10Gi
datasources:
  datasources.yaml:
    apiVersion: 1
    datasources:
    - name: Prometheus
      type: prometheus
      url: http://prometheus-server.monitoring.svc.cluster.local
      access: proxy
      isDefault: true
dashboardProviders:
  dashboardproviders.yaml:
    apiVersion: 1
    providers:
    - name: 'default'
      orgId: 1
      folder: ''
      type: file
      disableDeletion: false
      editable: true
      options:
        path: /var/lib/grafana/dashboards
service:
  type: LoadBalancer
EOF

# Step 4: Set up initial alerts
echo "⚠️  Configuring alert rules..."
kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: performance-alerts
  namespace: monitoring
spec:
  groups:
  - name: performance
    rules:
    - alert: HighLatency
      expr: histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le)) > 0.5
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: High latency detected
        description: 95th percentile latency is above 500ms
    - alert: HighErrorRate
      expr: sum(rate(http_requests_total{status=~"5.*"}[5m])) / sum(rate(http_requests_total[5m])) > 0.05
      for: 5m
      labels:
        severity: critical
      annotations:
        summary: High error rate detected
        description: Error rate is above 5%
    - alert: HighCPUUsage
      expr: sum(rate(container_cpu_usage_seconds_total{namespace="default"}[5m])) by (pod) > 0.8
      for: 10m
      labels:
        severity: warning
      annotations:
        summary: High CPU usage detected
        description: Pod CPU usage is above 80%
EOF

# Step 5: Deploy test data generator
echo "📝 Deploying test data generator..."
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test-data-generator
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: test-data-generator
  template:
    metadata:
      labels:
        app: test-data-generator
    spec:
      containers:
      - name: generator
        image: busybox
        command: ["/bin/sh", "-c"]
        args:
        - |
          while true; do
            echo "Generating test data at \$(date)"
            sleep 300
          done
EOF

# Step 6: Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
kubectl wait --for=condition=ready pod -l app=prometheus-server -n monitoring --timeout=300s
kubectl wait --for=condition=ready pod -l app=grafana -n monitoring --timeout=300s

# Step 7: Get access information
echo "📝 Getting access information..."
GRAFANA_PASSWORD=$(kubectl get secret --namespace monitoring grafana -o jsonpath="{.data.admin-password}" | base64 --decode)
GRAFANA_URL=$(kubectl get svc -n monitoring grafana -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

echo "
✅ Performance Environment Deployed Successfully!
----------------------------------------
Grafana URL: http://$GRAFANA_URL
Grafana Admin Password: $GRAFANA_PASSWORD

Next Steps:
1. Access Grafana at http://$GRAFANA_URL
2. Import the performance dashboards
3. Run initial load tests:
   k6 run -e API_URL=https://api.perf.rinawarptech.com ../tests/performance/initial-load.js

To clean up the environment:
  terraform destroy -target=module.perf_vpc -target=module.perf_eks -target=module.perf_monitoring -target=module.perf_rds -target=module.perf_redis
"

# Create a summary file
cat > ../perf-environment.txt <<EOF
Performance Environment Information
----------------------------------------
Deployed: $(date)
Environment: Performance Testing
Grafana URL: http://$GRAFANA_URL
Grafana Admin Password: $GRAFANA_PASSWORD

Monitoring Stack:
- Prometheus
- Grafana
- AlertManager

Infrastructure:
- EKS Cluster: rinawarp-perf
- RDS Instance: rinawarp-perf
- Redis Cluster: rinawarp-perf
- Load Testing Instances

Usage:
1. Access Grafana:
   URL: http://$GRAFANA_URL
   Username: admin
   Password: $GRAFANA_PASSWORD

2. Run load tests:
   cd ../tests/performance
   k6 run -e API_URL=https://api.perf.rinawarptech.com initial-load.js

3. View metrics:
   - Grafana Dashboards
   - CloudWatch Metrics
   - EKS Container Insights

4. Alert Rules:
   - High Latency (>500ms P95)
   - High Error Rate (>5%)
   - High CPU Usage (>80%)
EOF

echo "📋 Environment details saved to perf-environment.txt"
