#!/bin/bash

set -e

# Add Helm repositories
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Create namespaces
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -

# Install Prometheus Stack (includes Prometheus, Alertmanager, and Grafana)
helm upgrade --install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --values - << EOF
prometheus:
  prometheusSpec:
    retention: 15d
    resources:
      requests:
        cpu: 200m
        memory: 1Gi
      limits:
        cpu: 1000m
        memory: 2Gi
    storageSpec:
      volumeClaimTemplate:
        spec:
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 50Gi

  additionalServiceMonitors:
    - name: platform-monitor
      selector:
        matchLabels:
          app: platform
      namespaceSelector:
        matchNames:
          - rinawarp
      endpoints:
        - port: http
          path: /metrics
          interval: 15s

alertmanager:
  config:
    global:
      resolve_timeout: 5m
    route:
      group_by: ['alertname', 'severity']
      group_wait: 30s
      group_interval: 5m
      repeat_interval: 4h
      receiver: 'slack'
      routes:
        - match:
            severity: critical
          receiver: 'slack-critical'
    receivers:
      - name: 'slack'
        slack_configs:
          - api_url: '${SLACK_WEBHOOK_URL}'
            channel: '#monitoring'
            title: '{{ template "slack.default.title" . }}'
            text: '{{ template "slack.default.text" . }}'
            send_resolved: true
      - name: 'slack-critical'
        slack_configs:
          - api_url: '${SLACK_WEBHOOK_URL}'
            channel: '#monitoring-critical'
            title: '{{ template "slack.default.title" . }}'
            text: '{{ template "slack.default.text" . }}'
            send_resolved: true

grafana:
  persistence:
    enabled: true
    size: 10Gi
  adminPassword: "${GRAFANA_ADMIN_PASSWORD}"
  dashboardProviders:
    dashboardproviders.yaml:
      apiVersion: 1
      providers:
        - name: 'platform'
          orgId: 1
          folder: 'RinaWarp'
          type: file
          disableDeletion: true
          editable: true
          options:
            path: /var/lib/grafana/dashboards/platform
  dashboards:
    platform:
      platform-dashboard:
        file: dashboards/platform.json
  resources:
    requests:
      cpu: 100m
      memory: 256Mi
    limits:
      cpu: 500m
      memory: 512Mi

nodeExporter:
  enabled: true

kubeStateMetrics:
  enabled: true
EOF

# Apply PrometheusRules
kubectl apply -f k8s/monitoring/prometheus.yaml

# Wait for Grafana to be ready
kubectl rollout status deployment/monitoring-grafana -n monitoring

# Import dashboards
GRAFANA_POD=$(kubectl get pods -n monitoring -l app.kubernetes.io/name=grafana -o jsonpath="{.items[0].metadata.name}")
kubectl cp k8s/monitoring/dashboards/platform.json monitoring/$GRAFANA_POD:/tmp/platform.json
kubectl exec -n monitoring $GRAFANA_POD -- mkdir -p /var/lib/grafana/dashboards/platform
kubectl exec -n monitoring $GRAFANA_POD -- mv /tmp/platform.json /var/lib/grafana/dashboards/platform/

# Get Grafana URL and admin password
GRAFANA_URL=$(kubectl get ingress -n monitoring monitoring-grafana -o jsonpath="{.spec.rules[0].host}")
GRAFANA_PASSWORD=$(kubectl get secret monitoring-grafana-admin -n monitoring -o jsonpath="{.data.admin-password}" | base64 --decode)

echo "Monitoring stack installed successfully!"
echo "Grafana URL: https://$GRAFANA_URL"
echo "Grafana admin password: $GRAFANA_PASSWORD"
echo ""
echo "Next steps:"
echo "1. Configure Slack webhooks for alerts"
echo "2. Verify metrics collection"
echo "3. Test alerting system"
