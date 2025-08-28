#!/bin/bash

# Script to install AWS Load Balancer Controller

# Configuration
CLUSTER_NAME="rinawarp-${ENVIRONMENT}"
REGION=$(aws configure get region)
VPC_ID=$(aws eks describe-cluster --name ${CLUSTER_NAME} --query "cluster.resourcesVpcConfig.vpcId" --output text)

echo "Installing AWS Load Balancer Controller..."
echo "Cluster: ${CLUSTER_NAME}"
echo "Region: ${REGION}"
echo "VPC ID: ${VPC_ID}"

# Add the EKS chart repo
helm repo add eks https://aws.github.io/eks-charts
helm repo update

# Install cert-manager (required for ALB controller)
echo "Installing cert-manager..."
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.12.0/cert-manager.yaml
kubectl wait --for=condition=Ready pods -l app.kubernetes.io/instance=cert-manager -n cert-manager --timeout=120s

# Get OIDC provider
OIDC_ID=$(aws eks describe-cluster --name ${CLUSTER_NAME} --query "cluster.identity.oidc.issuer" --output text | cut -d'/' -f5)

# Check if IAM role exists
ROLE_NAME="aws-load-balancer-controller-${ENVIRONMENT}"
if ! aws iam get-role --role-name ${ROLE_NAME} 2>/dev/null; then
  echo "IAM role ${ROLE_NAME} not found. Please run Terraform to create it."
  exit 1
fi

# Create service account
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ServiceAccount
metadata:
  name: aws-load-balancer-controller
  namespace: kube-system
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::${AWS_ACCOUNT_ID}:role/${ROLE_NAME}
EOF

# Install ALB controller
echo "Installing AWS Load Balancer Controller..."
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=${CLUSTER_NAME} \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller \
  --set region=${REGION} \
  --set vpcId=${VPC_ID} \
  --set enableShield=${ENVIRONMENT == "production"} \
  --set enableWaf=${ENVIRONMENT == "production"} \
  --set enableAccessLog=true

# Wait for controller to be ready
kubectl wait --for=condition=Ready pods -l app.kubernetes.io/name=aws-load-balancer-controller -n kube-system --timeout=120s

echo "AWS Load Balancer Controller installation complete!"
echo "Verifying installation..."
kubectl get deployment -n kube-system aws-load-balancer-controller
