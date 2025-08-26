#!/bin/bash

set -e

echo "Setting up Kubernetes cluster for RinaWarp..."

# Create namespaces
kubectl create namespace rinawarp --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -

# Label namespaces
kubectl label namespace rinawarp name=rinawarp --overwrite
kubectl label namespace monitoring name=monitoring --overwrite

# Create storage class if it doesn't exist
kubectl apply -f - << EOF
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: standard
provisioner: kubernetes.io/aws-ebs
parameters:
  type: gp3
reclaimPolicy: Retain
allowVolumeExpansion: true
volumeBindingMode: WaitForFirstConsumer
EOF

# Apply secrets
kubectl apply -f k8s/production/secrets/

# Create roles and service accounts
kubectl apply -f - << EOF
apiVersion: v1
kind: ServiceAccount
metadata:
  name: platform-sa
  namespace: rinawarp
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: platform-role
  namespace: rinawarp
rules:
- apiGroups: [""]
  resources: ["secrets", "configmaps"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["pods", "services"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: platform-rb
  namespace: rinawarp
subjects:
- kind: ServiceAccount
  name: platform-sa
  namespace: rinawarp
roleRef:
  kind: Role
  name: platform-role
  apiGroup: rbac.authorization.k8s.io
EOF

# Set up network policies
kubectl apply -f - << EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
  namespace: rinawarp
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-monitoring
  namespace: rinawarp
spec:
  podSelector:
    matchLabels:
      app: platform
  policyTypes:
  - Ingress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: monitoring
    ports:
    - protocol: TCP
      port: 3000
EOF

echo "Cluster setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Verify namespaces are created:"
kubectl get namespaces | grep -E 'rinawarp|monitoring'
echo ""
echo "2. Verify secrets are created:"
kubectl get secrets -n rinawarp
echo ""
echo "3. Verify network policies:"
kubectl get networkpolicies -n rinawarp
