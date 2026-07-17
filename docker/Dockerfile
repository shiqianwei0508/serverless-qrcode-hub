# syntax=docker/dockerfile:1

# Build arg: whether to enable the China mirror (Aliyun apt / npmmirror npm) and Asia/Shanghai timezone
# Usage: docker build --build-arg USE_CN_MIRROR=true ...
ARG USE_CN_MIRROR=

FROM node:22-bookworm-slim

# Re-declare the ARG so it is available to later instructions
ARG USE_CN_MIRROR

# Set the timezone to Asia/Shanghai only when the China mirror is enabled; otherwise empty (default UTC)
ENV TZ=${USE_CN_MIRROR:+"Asia/Shanghai"}

# Enable the China mirror: switch apt to Aliyun, npm to npmmirror, and install tzdata to set the timezone
RUN if [ "$USE_CN_MIRROR" = "true" ]; then \
      sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources; \
      npm config set registry https://registry.npmmirror.com; \
      apt-get update && apt-get install -y --no-install-recommends tzdata; \
      ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime; \
      echo "Asia/Shanghai" > /etc/timezone; \
    fi

# Runtime dependencies: curl (healthcheck), ca-certificates (required by workerd/wrangler)
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the dependency manifest first to leverage layer caching
COPY package.json pnpm-lock.yaml* ./

# Install wrangler (includes the workerd runtime)
RUN npm install

# Copy application source and static assets (governed by the root .dockerignore)
COPY . .

# Copy container-specific config and startup script
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
COPY docker/wrangler.docker.toml /app/wrangler.docker.toml
RUN chmod +x /usr/local/bin/entrypoint.sh

# D1 data persistence directory (mounted to ./data at runtime)
RUN mkdir -p /app/data

EXPOSE 8787

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
