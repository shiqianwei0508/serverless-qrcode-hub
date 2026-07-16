# syntax=docker/dockerfile:1

# 构建参数：是否启用国内镜像源（apt 走阿里云、npm 走 npmmirror）与时区 Asia/Shanghai
# 用法：docker build --build-arg USE_CN_MIRROR=true ...
ARG USE_CN_MIRROR=

FROM node:22-bookworm-slim

# 重新声明 ARG 以便后续指令使用
ARG USE_CN_MIRROR

# 仅在启用国内镜像时设置时区为 Asia/Shanghai；否则为空（默认 UTC）
ENV TZ=${USE_CN_MIRROR:+"Asia/Shanghai"}

# 启用国内镜像源：apt 切换阿里云、npm 切换 npmmirror，并安装 tzdata 配置时区
RUN if [ "$USE_CN_MIRROR" = "true" ]; then \
      sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources; \
      npm config set registry https://registry.npmmirror.com; \
      apt-get update && apt-get install -y --no-install-recommends tzdata; \
      ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime; \
      echo "Asia/Shanghai" > /etc/timezone; \
    fi

# 运行时依赖：curl（健康检查）、ca-certificates（workerd/wrangler 需要）
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 先拷贝依赖清单，利用层缓存
COPY package.json pnpm-lock.yaml* ./

# 安装 wrangler（含 workerd 运行时）
RUN npm install

# 拷贝应用源码与静态资源（受根目录 .dockerignore 控制）
COPY . .

# 拷贝容器专用配置与启动脚本
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
COPY docker/wrangler.docker.toml /app/wrangler.docker.toml
RUN chmod +x /usr/local/bin/entrypoint.sh

# D1 数据持久化目录（运行时挂载 ./data 到此）
RUN mkdir -p /app/data

EXPOSE 8787

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
