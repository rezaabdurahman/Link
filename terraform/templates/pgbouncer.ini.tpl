[databases]
; Database connections for Link services
%{ for service, config in databases ~}
${config.database_name} = host=${postgres_host} port=${postgres_port} dbname=${config.database_name}
%{ endfor ~}

[pgbouncer]
; Connection pooling settings optimized for multi-instance deployment
listen_addr = 0.0.0.0
listen_port = 5432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt

; Pool settings
pool_mode = ${pool_mode}
default_pool_size = ${default_pool_size}
max_client_conn = ${max_client_conn}
max_db_connections = ${default_pool_size * length(databases)}

; Timeouts
server_reset_query = DISCARD ALL
server_check_query = SELECT 1
server_check_delay = 30

; Logging
log_connections = 1
log_disconnections = 1
log_pooler_errors = 1

[users]
; Users will be loaded from auth_file
