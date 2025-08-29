#!/bin/bash
set -e

# Configuration
export AWS_REGION=us-west-2
export ENVIRONMENT=perf
export DOMAIN=rinawarptech.com

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Function to print colored output
log() {
    local color=$1
    shift
    echo -e "${color}$@${NC}"
}

# Function to check required tools
check_requirements() {
    log $BLUE "Checking required tools..."
    
    local REQUIRED_TOOLS="terraform kubectl helm aws k6"
    local MISSING_TOOLS=()
    
    for tool in $REQUIRED_TOOLS; do
        if ! command -v $tool &> /dev/null; then
            MISSING_TOOLS+=($tool)
        fi
    done
    
    if [ ${#MISSING_TOOLS[@]} -ne 0 ]; then
        log $RED "Missing required tools: ${MISSING_TOOLS[*]}"
        log $RED "Please install these tools before continuing."
        exit 1
    fi
    
    log $GREEN "✓ All required tools are installed"
}

# Function to deploy infrastructure
deploy_infrastructure() {
    log $BLUE "Deploying infrastructure..."
    
    cd infrastructure/terraform
    
    # Initialize Terraform
    log $BLUE "Initializing Terraform..."
    terraform init -reconfigure
    
    # Plan Terraform changes
    log $BLUE "Planning infrastructure changes..."
    terraform plan \
        -target=module.perf_vpc \
        -target=module.perf_eks \
        -target=module.perf_monitoring \
        -target=module.perf_rds \
        -target=module.perf_redis \
        -out=perf.tfplan
    
    # Apply Terraform changes
    log $BLUE "Applying infrastructure changes..."
    terraform apply perf.tfplan
    
    cd ../..
    
    log $GREEN "✓ Infrastructure deployed successfully"
}

# Function to deploy monitoring stack
deploy_monitoring() {
    log $BLUE "Deploying monitoring stack..."
    
    # Configure kubectl
    log $BLUE "Configuring kubectl..."
    aws eks update-kubeconfig --name rinawarp-$ENVIRONMENT --region $AWS_REGION
    
    # Create monitoring namespace
    kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
    
    # Add Helm repositories
    log $BLUE "Adding Helm repositories..."
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo update
    
    # Deploy Prometheus
    log $BLUE "Deploying Prometheus..."
    helm upgrade --install prometheus prometheus-community/prometheus \
        --namespace monitoring \
        --set server.retention=15d \
        --set server.persistentVolume.size=50Gi \
        --set alertmanager.enabled=true \
        --set alertmanager.persistence.enabled=true
        
    # Deploy Grafana
    log $BLUE "Deploying Grafana..."
    helm upgrade --install grafana grafana/grafana \
        --namespace monitoring \
        --set persistence.enabled=true \
        --set persistence.size=10Gi \
        --set service.type=LoadBalancer
        
    log $GREEN "✓ Monitoring stack deployed successfully"
}

# Function to configure alerts
configure_alerts() {
    log $BLUE "Configuring alert rules..."
    
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
EOF
    
    log $GREEN "✓ Alert rules configured successfully"
}

# Function to run initial tests
run_initial_tests() {
    log $BLUE "Running initial performance tests..."
    
    # Get API endpoint
    local API_URL="https://api.$ENVIRONMENT.$DOMAIN"
    
    # Run k6 tests
    log $BLUE "Running k6 load tests..."
    cd tests/performance
    k6 run -e API_URL=$API_URL initial-load.js
    cd ../..
    
    log $GREEN "✓ Initial tests completed successfully"
}

# Function to generate deployment summary
generate_summary() {
    log $BLUE "Generating deployment summary..."
    
    # Get Grafana access info
    GRAFANA_PASSWORD=$(kubectl get secret --namespace monitoring grafana -o jsonpath="{.data.admin-password}" | base64 --decode)
    GRAFANA_URL=$(kubectl get svc -n monitoring grafana -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
    
    # Create summary file
    cat > perf-environment.txt <<EOF
Performance Environment Information
----------------------------------------
Deployed: $(date)
Environment: $ENVIRONMENT
Domain: $DOMAIN

Access Information:
- Grafana URL: http://$GRAFANA_URL
- Grafana Username: admin
- Grafana Password: $GRAFANA_PASSWORD
- API Endpoint: https://api.$ENVIRONMENT.$DOMAIN

Infrastructure:
- Region: $AWS_REGION
- EKS Cluster: rinawarp-$ENVIRONMENT
- RDS Instance: rinawarp-$ENVIRONMENT
- Redis Cluster: rinawarp-$ENVIRONMENT

Monitoring:
- Prometheus
- Grafana
- AlertManager

Alert Rules:
- High Latency (>500ms P95)
- High Error Rate (>5%)

Next Steps:
1. Access Grafana at http://$GRAFANA_URL
2. Import additional dashboards
3. Configure alert notifications
4. Run comprehensive performance tests

Cleanup:
terraform destroy -target=module.perf_vpc -target=module.perf_eks -target=module.perf_monitoring -target=module.perf_rds -target=module.perf_redis
EOF
    
    log $GREEN "✓ Deployment summary generated: perf-environment.txt"
}

# Main deployment process
main() {
    log $BLUE "Starting performance environment deployment..."
    
    check_requirements
    deploy_infrastructure
    deploy_monitoring
    configure_alerts
    run_initial_tests
    generate_summary
    
    log $GREEN "✅ Performance environment deployment completed successfully!"
    log $BLUE "Please check perf-environment.txt for access information and next steps."
}

# Run main process
main
