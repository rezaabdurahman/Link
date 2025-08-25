# Redis Backup Image with AWS CLI and tools
FROM redis:7-alpine

# Install required packages
RUN apk add --no-cache \
    aws-cli \
    openssl \
    curl \
    bash \
    jq \
    tar \
    gzip

# Create backup user  
RUN adduser -D -s /bin/bash backup

# Set up directories
RUN mkdir -p /var/lib/redis/backup \
    && chown -R backup:backup /var/lib/redis/backup

# Copy backup scripts
COPY scripts/ /usr/local/bin/
RUN chmod +x /usr/local/bin/*

USER backup

ENTRYPOINT ["/usr/local/bin/backup-redis.sh"]