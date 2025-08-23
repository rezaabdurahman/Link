# Qdrant Cluster Module Outputs

output "cluster_endpoint" {
  description = "Qdrant cluster service endpoint for internal access"
  value       = "${kubernetes_service.qdrant_cluster.metadata[0].name}.${var.namespace}.svc.cluster.local"
}

output "grpc_endpoint" {
  description = "Qdrant gRPC endpoint with port"
  value       = "${kubernetes_service.qdrant_cluster.metadata[0].name}.${var.namespace}.svc.cluster.local:6334"
}

output "rest_endpoint" {
  description = "Qdrant REST endpoint with port"
  value       = "${kubernetes_service.qdrant_cluster.metadata[0].name}.${var.namespace}.svc.cluster.local:6333"
}

output "load_balancer_ip" {
  description = "Load balancer external IP (if applicable)"
  value       = var.load_balancer_type == "LoadBalancer" ? kubernetes_service.qdrant_cluster.status[0].load_balancer[0].ingress[0].ip : null
}

output "load_balancer_hostname" {
  description = "Load balancer external hostname (if applicable)"
  value       = var.load_balancer_type == "LoadBalancer" ? kubernetes_service.qdrant_cluster.status[0].load_balancer[0].ingress[0].hostname : null
}

output "cluster_size" {
  description = "Number of nodes in the Qdrant cluster"
  value       = var.cluster_size
}

output "replication_factor" {
  description = "Configured replication factor"
  value       = var.replication_factor
}

output "node_endpoints" {
  description = "Individual node endpoints for direct access"
  value = concat(
    [kubernetes_service.qdrant_node_1.metadata[0].name],
    [for service in kubernetes_service.qdrant_nodes : service.metadata[0].name]
  )
}

output "storage_class" {
  description = "Storage class used for persistent volumes"
  value       = var.create_storage_class ? kubernetes_storage_class.qdrant_storage[0].metadata[0].name : var.storage_class_name
}

output "namespace" {
  description = "Kubernetes namespace where Qdrant is deployed"
  value       = var.namespace
}

output "service_name" {
  description = "Qdrant cluster service name"
  value       = kubernetes_service.qdrant_cluster.metadata[0].name
}

output "config_map_name" {
  description = "ConfigMap name containing Qdrant configuration"
  value       = kubernetes_config_map.qdrant_config.metadata[0].name
}

output "pod_disruption_budget_name" {
  description = "Pod Disruption Budget name"
  value       = kubernetes_pod_disruption_budget.qdrant_cluster.metadata[0].name
}

output "hpa_enabled" {
  description = "Whether Horizontal Pod Autoscaler is enabled"
  value       = var.enable_hpa
}

output "hpa_name" {
  description = "Horizontal Pod Autoscaler name (if enabled)"
  value       = var.enable_hpa ? kubernetes_horizontal_pod_autoscaler_v2.qdrant_cluster[0].metadata[0].name : null
}

# Connection information for applications
output "connection_config" {
  description = "Complete connection configuration for applications"
  value = {
    host                = kubernetes_service.qdrant_cluster.metadata[0].name
    namespace           = var.namespace
    grpc_port          = 6334
    rest_port          = 6333
    full_grpc_endpoint = "${kubernetes_service.qdrant_cluster.metadata[0].name}.${var.namespace}.svc.cluster.local:6334"
    full_rest_endpoint = "${kubernetes_service.qdrant_cluster.metadata[0].name}.${var.namespace}.svc.cluster.local:6333"
    use_tls            = false
    collection_name    = "user_profiles"
    timeout            = "30s"
  }
}