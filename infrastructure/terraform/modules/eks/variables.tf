variable "cluster_name" {
  description = "Name of the EKS cluster"
  type        = string
}

variable "cluster_version" {
  description = "Kubernetes version to use for the EKS cluster"
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC where the cluster will be created"
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs where cluster will be created"
  type        = list(string)
}

variable "node_groups" {
  description = "Node groups configuration"
  type = map(object({
    name           = string
    instance_types = list(string)
    min_size       = number
    max_size       = number
    desired_size   = number
    labels         = map(string)
    taints         = list(object({
      key    = string
      value  = string
      effect = string
    }))
  }))
}
