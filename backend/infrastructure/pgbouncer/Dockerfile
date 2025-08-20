FROM pgbouncer/pgbouncer:1.21.0

# Install additional tools for startup script and monitoring
USER root
RUN apt-get update && \
    apt-get install -y postgresql-client curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create pgbouncer user and directories
RUN groupadd -r pgbouncer && \
    useradd -r -g pgbouncer -d /etc/pgbouncer -s /bin/bash pgbouncer

# Copy configuration files
COPY pgbouncer.ini /etc/pgbouncer/pgbouncer.ini
COPY userlist.txt /etc/pgbouncer/userlist.txt
COPY startup.sh /usr/local/bin/startup.sh

# Set permissions
RUN chown -R pgbouncer:pgbouncer /etc/pgbouncer && \
    chmod 755 /usr/local/bin/startup.sh && \
    chmod 600 /etc/pgbouncer/userlist.txt && \
    chmod 644 /etc/pgbouncer/pgbouncer.ini

# Create health check script
RUN cat > /usr/local/bin/health-check.sh << 'EOF'
#!/bin/bash
# PgBouncer health check
if ! pg_isready -h localhost -p 5432 -q; then
    exit 1
fi

# Check if PgBouncer is responding to SHOW POOLS
if ! psql -h localhost -p 5432 -U pgbouncer_stats -d pgbouncer -c "SHOW POOLS;" > /dev/null 2>&1; then
    exit 1
fi

exit 0
EOF

RUN chmod 755 /usr/local/bin/health-check.sh

# Switch to pgbouncer user
USER pgbouncer

# Expose port
EXPOSE 5432

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD /usr/local/bin/health-check.sh

# Use startup script as entrypoint
ENTRYPOINT ["/usr/local/bin/startup.sh"]
