output "cluster_zone_id" {
  value       = aws_eks_cluster.main.vpc_config[0].cluster_security_group_id
  description = "The zone ID of the EKS cluster"
}

output "cluster_role_arn" {
  value       = aws_iam_role.cluster.arn
  description = "The ARN of the EKS cluster IAM role"
}
