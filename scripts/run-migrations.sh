#!/bin/bash

set -e

echo "Running database migrations..."

# Wait for database to be ready
kubectl wait --for=condition=ready pod -l app=postgres -n rinawarp --timeout=300s

# Get database password from secret
DB_PASSWORD=$(kubectl get secret postgres-secrets -n rinawarp -o jsonpath="{.data.password}" | base64 --decode)

# Create migration job
cat << EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migrate
  namespace: rinawarp
spec:
  backoffLimit: 4
  template:
    spec:
      containers:
      - name: migrate
        image: rinawarptech/platform:latest
        command: ["npm", "run", "db:migrate"]
        env:
        - name: DATABASE_URL
          value: postgresql://rinawarp_admin:${DB_PASSWORD}@postgres:5432/rinawarp
      restartPolicy: Never
EOF

# Wait for migration to complete
echo "Waiting for migration to complete..."
kubectl wait --for=condition=complete job/db-migrate -n rinawarp --timeout=300s

# Get logs
echo "Migration logs:"
kubectl logs job/db-migrate -n rinawarp

# Clean up
kubectl delete job db-migrate -n rinawarp

echo "Database migration completed"
