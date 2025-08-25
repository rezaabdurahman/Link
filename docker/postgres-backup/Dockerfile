# PostgreSQL Backup Image with AWS CLI and encryption tools
FROM postgres:16-alpine

# Install required packages
RUN apk add --no-cache \
    aws-cli \
    openssl \
    curl \
    bash \
    gettext \
    tar \
    gzip

# Create backup user
RUN adduser -D -s /bin/bash backup

# Set up directories
RUN mkdir -p /var/lib/postgresql/backup \
    && chown -R backup:backup /var/lib/postgresql/backup

# Copy backup scripts
COPY scripts/ /usr/local/bin/
RUN chmod +x /usr/local/bin/*

USER backup

ENTRYPOINT ["/usr/local/bin/backup-postgres.sh"]