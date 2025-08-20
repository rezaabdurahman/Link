# Service Databases Terraform Module
# Based on ADR-002: Distributed Database Strategy
#
# Creates isolated databases for each service within a single PostgreSQL cluster
# Solves connection pool exhaustion and enables independent service scaling

terraform {
  required_version = ">= 1.5.7"
  required_providers {
    postgresql = {
      source  = "cyrilgdn/postgresql"
      version = "= 1.21.0"  # Exact version for production stability
    }
    random = {
      source  = "hashicorp/random"
      version = "= 3.4.0"   # Exact version for production stability
    }
  }
}

# Local values for service configuration
locals {
  # Service database configurations
  # Each service gets its own database and user for isolation
  services = {
    users = {
      database_name = "link_users"
      username      = "link_users_user"
      description   = "User management, authentication, and profiles"
    }
    chat = {
      database_name = "link_chat"
      username      = "link_chat_user"
      description   = "Chat rooms, messages, and real-time communication"
    }
    ai = {
      database_name = "link_ai" 
      username      = "link_ai_user"
      description   = "AI processing, conversations, and privacy/consent management"
    }
    search = {
      database_name = "link_search"
      username      = "link_search_user"
      description   = "Vector search, embeddings, and content indexing"
    }
    discovery = {
      database_name = "link_discovery"
      username      = "link_discovery_user"
      description   = "User discovery, availability, and location features"
    }
  }
  
  # Connection pool settings optimized for multi-instance deployment
  connection_pool_settings = {
    max_open_connections     = 10
    max_idle_connections     = 5
    connection_max_lifetime  = "5m"
  }
}

# Generate secure random passwords for each service
resource "random_password" "service_passwords" {
  for_each = local.services
  
  length  = 32
  special = true
  upper   = true
  lower   = true
  numeric = true
  
  # Ensure password regeneration doesn't cause issues
  keepers = {
    service = each.key
  }
}

# Create databases for each service
resource "postgresql_database" "service_databases" {
  for_each = local.services
  
  name              = each.value.database_name
  owner             = postgresql_role.service_users[each.key].name
  template          = "template0"
  lc_collate        = "en_US.utf8"
  lc_ctype          = "en_US.utf8"
  connection_limit  = var.database_connection_limit
  allow_connections = true
  
  # Database depends only on service users, not extensions
  depends_on = [
    postgresql_role.service_users
  ]
  
  lifecycle {
    prevent_destroy = true
  }
}

# Create dedicated users for each service
resource "postgresql_role" "service_users" {
  for_each = local.services
  
  name     = each.value.username
  login    = true
  password = random_password.service_passwords[each.key].result
  
  # Security settings
  encrypted_password      = true
  valid_until            = "infinity"
  connection_limit       = var.user_connection_limit
  inherit                = true
  create_database        = false
  create_role           = false
  replication           = false
  bypass_row_level_security = false
  superuser             = false
  
  # Prevent accidental deletion
  lifecycle {
    prevent_destroy = true
  }
}

# Grant necessary permissions to service users on their databases
resource "postgresql_grant" "database_privileges" {
  for_each = local.services
  
  database    = postgresql_database.service_databases[each.key].name
  role        = postgresql_role.service_users[each.key].name
  schema      = "public"
  object_type = "database"
  privileges  = ["CONNECT", "CREATE", "TEMPORARY"]
  
  depends_on = [
    postgresql_database.service_databases,
    postgresql_role.service_users
  ]
}

# Grant schema privileges
resource "postgresql_grant" "schema_privileges" {
  for_each = local.services
  
  database    = postgresql_database.service_databases[each.key].name
  role        = postgresql_role.service_users[each.key].name
  schema      = "public"
  object_type = "schema"
  privileges  = ["USAGE", "CREATE"]
  
  depends_on = [postgresql_database.service_databases]
}

# Grant table privileges (for existing and future tables)
resource "postgresql_grant" "table_privileges" {
  for_each = local.services
  
  database    = postgresql_database.service_databases[each.key].name
  role        = postgresql_role.service_users[each.key].name
  schema      = "public"
  object_type = "table"
  privileges  = ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"]
  
  depends_on = [postgresql_database.service_databases]
}

# Grant sequence privileges (for auto-incrementing IDs)
resource "postgresql_grant" "sequence_privileges" {
  for_each = local.services
  
  database    = postgresql_database.service_databases[each.key].name
  role        = postgresql_role.service_users[each.key].name
  schema      = "public"
  object_type = "sequence"
  privileges  = ["USAGE", "SELECT", "UPDATE"]
  
  depends_on = [postgresql_database.service_databases]
}

# Enable UUID extension for all service databases
resource "postgresql_extension" "uuid_extension" {
  for_each = local.services
  
  name     = "uuid-ossp"
  database = postgresql_database.service_databases[each.key].name
  schema   = "public"
  version  = "1.1"
  
  depends_on = [postgresql_database.service_databases]
}

# Enable pgvector extension for search service (and others that might need it)
resource "postgresql_extension" "pgvector_extension" {
  for_each = local.services
  
  name     = "vector"
  database = postgresql_database.service_databases[each.key].name
  schema   = "public"
  
  depends_on = [postgresql_database.service_databases]
  
  # Only create if pgvector is available (ignore errors for services that don't need it)
  lifecycle {
    ignore_changes = all
  }
}

# Create default privileges for future tables and sequences
resource "postgresql_default_privileges" "future_table_privileges" {
  for_each = local.services
  
  role        = postgresql_role.service_users[each.key].name
  database    = postgresql_database.service_databases[each.key].name
  schema      = "public"
  owner       = postgresql_role.service_users[each.key].name
  object_type = "table"
  privileges  = ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"]
  
  depends_on = [postgresql_role.service_users]
}

resource "postgresql_default_privileges" "future_sequence_privileges" {
  for_each = local.services
  
  role        = postgresql_role.service_users[each.key].name
  database    = postgresql_database.service_databases[each.key].name
  schema      = "public"
  owner       = postgresql_role.service_users[each.key].name
  object_type = "sequence"
  privileges  = ["USAGE", "SELECT", "UPDATE"]
  
  depends_on = [postgresql_role.service_users]
}

# Create monitoring user for observability
resource "postgresql_role" "monitoring_user" {
  count = var.create_monitoring_user ? 1 : 0
  
  name     = "link_monitoring"
  login    = true
  password = random_password.monitoring_password[0].result
  
  # Monitoring-specific permissions
  encrypted_password      = true
  connection_limit       = 5
  inherit                = true
  create_database        = false
  create_role           = false
  replication           = false
  bypass_row_level_security = false
  superuser             = false
}

resource "random_password" "monitoring_password" {
  count = var.create_monitoring_user ? 1 : 0
  
  length  = 32
  special = true
}

# Grant monitoring permissions to all service databases
resource "postgresql_grant" "monitoring_privileges" {
  for_each = var.create_monitoring_user ? local.services : {}
  
  database    = postgresql_database.service_databases[each.key].name
  role        = postgresql_role.monitoring_user[0].name
  schema      = "public"
  object_type = "table"
  privileges  = ["SELECT"]
  
  depends_on = [
    postgresql_database.service_databases,
    postgresql_role.monitoring_user
  ]
}

# Connection pool configuration (for documentation/reference)
resource "null_resource" "connection_pool_documentation" {
  triggers = {
    documentation = jsonencode({
      description = "Connection pool settings for multi-instance deployment"
      settings = local.connection_pool_settings
      expected_connections = {
        before_isolation = "500+ connections with shared database"
        after_isolation  = "~90 connections (10 per service × ~9 instances)"
      }
      services = {
        for k, v in local.services : k => {
          database = v.database_name
          user     = v.username
          max_connections_per_instance = local.connection_pool_settings.max_open_connections
        }
      }
    })
  }
}
