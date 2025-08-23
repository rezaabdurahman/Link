# Qdrant Cluster Module for Production Deployment

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
  }
}

# Qdrant ConfigMap
resource "kubernetes_config_map" "qdrant_config" {
  metadata {
    name      = "qdrant-config"
    namespace = var.namespace
    labels = {
      app       = "qdrant-cluster"
      component = "config"
    }
  }

  data = {
    "production.yaml" = yamlencode({
      service = {
        host                 = "0.0.0.0"
        http_port           = 6333
        grpc_port           = 6334
        enable_cors         = true
        max_request_size_mb = 32
        max_workers         = 0
      }
      cluster = {
        enabled = true
        p2p = {
          port = 6335
        }
        consensus = {
          tick_period_ms = 100
        }
      }
      storage = {
        storage_path = "/qdrant/storage"
        memory = {
          shared_memory       = true
          mmap_threshold_kb   = 2048000
        }
        performance = {
          max_search_threads       = 0
          max_optimization_threads = 2
        }
        wal = {
          wal_capacity_mb    = 64
          wal_segments_ahead = 2
        }
      }
      collections = {
        default_vector_config = {
          size     = 1536
          distance = "Cosine"
        }
        replication = {
          replication_factor      = var.replication_factor
          write_consistency_factor = 1
        }
        indexing = {
          hnsw_config = {
            m                      = 16
            ef_construct          = 200
            full_scan_threshold   = 10000
          }
          payload_index = {
            auto_indexing = true
          }
        }
        optimization = {
          default_segment_number   = 0
          memmap_threshold_kb     = 200000
          indexing_threshold_kb   = 20000
          flush_interval_sec      = 5
          max_segment_size_kb     = 2000000
        }
      }
      log_level           = var.log_level
      telemetry_disabled  = true
      cluster_settings = {
        heartbeat_interval_ms = 1000
        cluster_timeout_ms    = 5000
        enable_cluster_info   = true
      }
    })
  }
}

# Storage Class for fast SSD
resource "kubernetes_storage_class" "qdrant_storage" {
  count = var.create_storage_class ? 1 : 0
  
  metadata {
    name = "qdrant-fast-ssd"
    labels = {
      app       = "qdrant-cluster"
      component = "storage"
    }
  }
  
  storage_provisioner    = var.storage_provisioner
  reclaim_policy        = "Retain"
  volume_binding_mode   = "WaitForFirstConsumer"
  allow_volume_expansion = true
  
  parameters = var.storage_parameters
}

# Qdrant Bootstrap Node (Node 1)
resource "kubernetes_stateful_set" "qdrant_node_1" {
  metadata {
    name      = "qdrant-node-1"
    namespace = var.namespace
    labels = {
      app       = "qdrant-cluster"
      node      = "node-1"
      component = "vector-database"
    }
  }

  spec {
    service_name = "qdrant-node-1"
    replicas     = 1

    selector {
      match_labels = {
        app  = "qdrant-cluster"
        node = "node-1"
      }
    }

    template {
      metadata {
        labels = {
          app       = "qdrant-cluster"
          node      = "node-1"
          component = "vector-database"
        }
        annotations = {
          "linkerd.io/inject"                     = "enabled"
          "config.linkerd.io/proxy-cpu-request"  = "50m"
          "config.linkerd.io/proxy-memory-request" = "32Mi"
        }
      }

      spec {
        affinity {
          pod_anti_affinity {
            required_during_scheduling_ignored_during_execution {
              label_selector {
                match_expressions {
                  key      = "app"
                  operator = "In"
                  values   = ["qdrant-cluster"]
                }
              }
              topology_key = "kubernetes.io/hostname"
            }
          }
        }

        container {
          name  = "qdrant"
          image = "qdrant/qdrant:${var.qdrant_version}"

          port {
            container_port = 6333
            name          = "rest-api"
          }
          port {
            container_port = 6334
            name          = "grpc-api"
          }
          port {
            container_port = 6335
            name          = "p2p"
          }

          env {
            name  = "QDRANT__CLUSTER__ENABLED"
            value = "true"
          }
          env {
            name  = "QDRANT__CLUSTER__P2P__PORT"
            value = "6335"
          }
          env {
            name  = "QDRANT__CLUSTER__NODE_ID"
            value = "1"
          }
          env {
            name  = "QDRANT__SERVICE__HTTP_PORT"
            value = "6333"
          }
          env {
            name  = "QDRANT__SERVICE__GRPC_PORT"
            value = "6334"
          }
          env {
            name  = "QDRANT__LOG_LEVEL"
            value = var.log_level
          }
          env {
            name  = "QDRANT__STORAGE__MEMORY__SHARED_MEMORY"
            value = "true"
          }

          volume_mount {
            name       = "qdrant-storage"
            mount_path = "/qdrant/storage"
          }
          volume_mount {
            name       = "qdrant-config"
            mount_path = "/qdrant/config"
            read_only  = true
          }

          resources {
            requests = {
              memory = var.node_memory_request
              cpu    = var.node_cpu_request
            }
            limits = {
              memory = var.node_memory_limit
              cpu    = var.node_cpu_limit
            }
          }

          liveness_probe {
            http_get {
              path = "/health"
              port = 6333
            }
            initial_delay_seconds = 30
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          readiness_probe {
            http_get {
              path = "/health"
              port = 6333
            }
            initial_delay_seconds = 10
            period_seconds        = 5
            timeout_seconds       = 3
            failure_threshold     = 2
          }
        }

        volume {
          name = "qdrant-config"
          config_map {
            name = kubernetes_config_map.qdrant_config.metadata[0].name
          }
        }
      }
    }

    volume_claim_template {
      metadata {
        name = "qdrant-storage"
      }
      spec {
        access_modes       = ["ReadWriteOnce"]
        storage_class_name = var.create_storage_class ? kubernetes_storage_class.qdrant_storage[0].metadata[0].name : var.storage_class_name
        resources {
          requests = {
            storage = var.storage_size
          }
        }
      }
    }
  }
}

# Qdrant Node 2 and 3 (similar structure, peer to node-1)
resource "kubernetes_stateful_set" "qdrant_nodes" {
  count = var.cluster_size - 1
  
  metadata {
    name      = "qdrant-node-${count.index + 2}"
    namespace = var.namespace
    labels = {
      app       = "qdrant-cluster"
      node      = "node-${count.index + 2}"
      component = "vector-database"
    }
  }

  spec {
    service_name = "qdrant-node-${count.index + 2}"
    replicas     = 1

    selector {
      match_labels = {
        app  = "qdrant-cluster"
        node = "node-${count.index + 2}"
      }
    }

    template {
      metadata {
        labels = {
          app       = "qdrant-cluster"
          node      = "node-${count.index + 2}"
          component = "vector-database"
        }
        annotations = {
          "linkerd.io/inject"                     = "enabled"
          "config.linkerd.io/proxy-cpu-request"  = "50m"
          "config.linkerd.io/proxy-memory-request" = "32Mi"
        }
      }

      spec {
        affinity {
          pod_anti_affinity {
            required_during_scheduling_ignored_during_execution {
              label_selector {
                match_expressions {
                  key      = "app"
                  operator = "In"
                  values   = ["qdrant-cluster"]
                }
              }
              topology_key = "kubernetes.io/hostname"
            }
          }
        }

        container {
          name  = "qdrant"
          image = "qdrant/qdrant:${var.qdrant_version}"

          port {
            container_port = 6333
            name          = "rest-api"
          }
          port {
            container_port = 6334
            name          = "grpc-api"
          }
          port {
            container_port = 6335
            name          = "p2p"
          }

          env {
            name  = "QDRANT__CLUSTER__ENABLED"
            value = "true"
          }
          env {
            name  = "QDRANT__CLUSTER__P2P__PORT"
            value = "6335"
          }
          env {
            name  = "QDRANT__CLUSTER__NODE_ID"
            value = tostring(count.index + 2)
          }
          env {
            name  = "QDRANT__CLUSTER__BOOTSTRAP__PEER"
            value = "qdrant-node-1.${var.namespace}.svc.cluster.local:6335"
          }
          env {
            name  = "QDRANT__SERVICE__HTTP_PORT"
            value = "6333"
          }
          env {
            name  = "QDRANT__SERVICE__GRPC_PORT"
            value = "6334"
          }
          env {
            name  = "QDRANT__LOG_LEVEL"
            value = var.log_level
          }
          env {
            name  = "QDRANT__STORAGE__MEMORY__SHARED_MEMORY"
            value = "true"
          }

          volume_mount {
            name       = "qdrant-storage"
            mount_path = "/qdrant/storage"
          }
          volume_mount {
            name       = "qdrant-config"
            mount_path = "/qdrant/config"
            read_only  = true
          }

          resources {
            requests = {
              memory = var.node_memory_request
              cpu    = var.node_cpu_request
            }
            limits = {
              memory = var.node_memory_limit
              cpu    = var.node_cpu_limit
            }
          }

          liveness_probe {
            http_get {
              path = "/health"
              port = 6333
            }
            initial_delay_seconds = 30
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          readiness_probe {
            http_get {
              path = "/health"
              port = 6333
            }
            initial_delay_seconds = 10
            period_seconds        = 5
            timeout_seconds       = 3
            failure_threshold     = 2
          }
        }

        volume {
          name = "qdrant-config"
          config_map {
            name = kubernetes_config_map.qdrant_config.metadata[0].name
          }
        }
      }
    }

    volume_claim_template {
      metadata {
        name = "qdrant-storage"
      }
      spec {
        access_modes       = ["ReadWriteOnce"]
        storage_class_name = var.create_storage_class ? kubernetes_storage_class.qdrant_storage[0].metadata[0].name : var.storage_class_name
        resources {
          requests = {
            storage = var.storage_size
          }
        }
      }
    }
  }

  depends_on = [kubernetes_stateful_set.qdrant_node_1]
}

# Services for each node
resource "kubernetes_service" "qdrant_node_1" {
  metadata {
    name      = "qdrant-node-1"
    namespace = var.namespace
    labels = {
      app       = "qdrant-cluster"
      node      = "node-1"
    }
    annotations = {
      "viz.linkerd.io/tap-enabled" = "true"
    }
  }

  spec {
    selector = {
      app  = "qdrant-cluster"
      node = "node-1"
    }

    port {
      name        = "rest-api"
      port        = 6333
      target_port = 6333
    }
    port {
      name        = "grpc-api"
      port        = 6334
      target_port = 6334
    }
    port {
      name        = "p2p"
      port        = 6335
      target_port = 6335
    }

    type = "ClusterIP"
  }
}

resource "kubernetes_service" "qdrant_nodes" {
  count = var.cluster_size - 1
  
  metadata {
    name      = "qdrant-node-${count.index + 2}"
    namespace = var.namespace
    labels = {
      app       = "qdrant-cluster"
      node      = "node-${count.index + 2}"
    }
    annotations = {
      "viz.linkerd.io/tap-enabled" = "true"
    }
  }

  spec {
    selector = {
      app  = "qdrant-cluster"
      node = "node-${count.index + 2}"
    }

    port {
      name        = "rest-api"
      port        = 6333
      target_port = 6333
    }
    port {
      name        = "grpc-api"
      port        = 6334
      target_port = 6334
    }
    port {
      name        = "p2p"
      port        = 6335
      target_port = 6335
    }

    type = "ClusterIP"
  }
}

# Load Balancer Service
resource "kubernetes_service" "qdrant_cluster" {
  metadata {
    name      = "qdrant-cluster"
    namespace = var.namespace
    labels = {
      app       = "qdrant-cluster"
      component = "load-balancer"
    }
    annotations = merge(
      {
        "viz.linkerd.io/tap-enabled" = "true"
      },
      var.load_balancer_annotations
    )
  }

  spec {
    selector = {
      app = "qdrant-cluster"
    }

    port {
      name        = "rest-api"
      port        = 6333
      target_port = 6333
      protocol    = "TCP"
    }
    port {
      name        = "grpc-api"
      port        = 6334
      target_port = 6334
      protocol    = "TCP"
    }

    type             = var.load_balancer_type
    session_affinity = "None"
  }
}

# Pod Disruption Budget
resource "kubernetes_pod_disruption_budget" "qdrant_cluster" {
  metadata {
    name      = "qdrant-cluster-pdb"
    namespace = var.namespace
    labels = {
      app = "qdrant-cluster"
    }
  }

  spec {
    min_available = var.min_available_pods
    selector {
      match_labels = {
        app = "qdrant-cluster"
      }
    }
  }
}

# Horizontal Pod Autoscaler (optional)
resource "kubernetes_horizontal_pod_autoscaler_v2" "qdrant_cluster" {
  count = var.enable_hpa ? 1 : 0
  
  metadata {
    name      = "qdrant-cluster-hpa"
    namespace = var.namespace
    labels = {
      app = "qdrant-cluster"
    }
  }

  spec {
    scale_target_ref {
      api_version = "apps/v1"
      kind        = "StatefulSet"
      name        = "qdrant-node-2"  # Scale read replicas
    }

    min_replicas = 1
    max_replicas = var.max_replicas

    metric {
      type = "Resource"
      resource {
        name = "cpu"
        target {
          type                = "Utilization"
          average_utilization = var.cpu_target_utilization
        }
      }
    }

    metric {
      type = "Resource"
      resource {
        name = "memory"
        target {
          type                = "Utilization"
          average_utilization = var.memory_target_utilization
        }
      }
    }

    behavior {
      scale_down {
        stabilization_window_seconds = 300
        policy {
          type          = "Percent"
          value         = 10
          period_seconds = 60
        }
      }
      scale_up {
        stabilization_window_seconds = 60
        policy {
          type          = "Percent"
          value         = 50
          period_seconds = 60
        }
      }
    }
  }
}