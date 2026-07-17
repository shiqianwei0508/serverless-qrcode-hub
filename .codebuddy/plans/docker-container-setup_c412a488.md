---
name: docker-container-setup
overview: 在 docker/ 目录下提供一套基于 wrangler dev --local 的容器化启动方案，将 D1 数据持久化到部署目录的 ./data，通过构建变量 USE_CN_MIRROR 控制是否启用国内镜像源（apt/npm）与 Asia/Shanghai 时区。
todos:
  - id: create-dockerfile
    content: 创建 docker/Dockerfile，支持 USE_CN_MIRROR 控制国内镜像源与 Asia/Shanghai 时区
    status: completed
  - id: create-config-entrypoint
    content: 创建 wrangler.docker.toml 与 entrypoint.sh 启动脚本
    status: completed
    dependencies:
      - create-dockerfile
  - id: create-compose
    content: 创建 docker-compose.yml 与项目根 .dockerignore 编排卷与健康检查
    status: completed
    dependencies:
      - create-config-entrypoint
  - id: verify-build
    content: 本地构建并验证数据持久化、国内镜像源及时区生效
    status: completed
    dependencies:
      - create-compose
---

## 用户需求

- 在项目根目录创建 `docker/` 目录，提供一套容器化启动方案。
- 容器启动时，将 D1（SQLite）等状态数据持久化到部署目录下的 `data/` 目录（通过挂载卷实现，重启不丢数据）。
- 通过构建变量 `USE_CN_MIRROR` 控制是否启用国内镜像源（apt 走阿里云、npm 走 npmmirror.com），默认不启用。
- 当启用国内镜像源（`USE_CN_MIRROR=true`）时，额外将容器时区设置为 `Asia/Shanghai`。

## 产品概述

为 `serverless-qrcode-hub`（Cloudflare Workers + D1 二维码活码服务）提供本地 Docker 部署能力。基于 `wrangler dev --local` 在容器内以本地模式运行 workerd 运行时，完全离线、不依赖 Cloudflare 账号，并把 D1 数据写入挂载的 `./data` 卷实现持久化。通过构建参数一键切换国内镜像加速与 Asia/Shanghai 时区。

## 核心功能

- `Dockerfile` 构建镜像（node:22-bookworm-slim），可选国内镜像源加速与 Asia/Shanghai 时区。
- `docker-compose.yml` 一键启动，暴露 8787 端口，自带健康检查（curl 探测 /admin.html）。
- 数据卷 `./data:/app/data` 持久化 D1 SQLite 数据。
- 通过环境变量 `APP_PASSWORD` 设置后台登录密码（默认 test1234）。
- 独立的 `wrangler.docker.toml`，不污染生产 `wrangler.toml` 配置。

## 技术栈

- 容器：Docker + Docker Compose
- 基础镜像：`node:22-bookworm-slim`（附带 workerd 运行所需依赖）
- 本地运行：`wrangler@^4`（package.json 已有 devDependency）→ `wrangler dev --local`
- 数据持久化：`wrangler --persist-to /app/data` → 挂载 `./data` 卷
- 健康检查：`curl` 探测 `http://localhost:8787/admin.html`

## 实现思路

- **运行方式**：采用 `wrangler dev --local`，复用现有 `wrangler.toml` 的 `main` / `[assets]` / `[[d1_databases]]` 配置，由 workerd 本地模拟 Workers 运行时，完全离线、无需 Cloudflare 账号。复用度最高、最贴近现有 `npm run dev` 命令，运维心智一致。
- **数据持久化**：本地模式下 D1 的 SQLite 文件位于 `--persist-to` 指定目录下的 `v3/d1/<database_id>.sqlite`。固定 `database_id` 可保证跨容器重启文件路径一致，数据不丢。将该目录挂载到宿主机 `./data` 即实现主机级持久化。
- **国内镜像源 + 时区（USE_CN_MIRROR）**：通过构建参数 `USE_CN_MIRROR`（默认 `false`）控制，在 `FROM` 前后各声明一次 `ARG`，使镜像设置在构建期内生效。为 `true` 时：
- `sed` 将 apt 源 `deb.debian.org` 切换为 `mirrors.aliyun.com`；
- `npm config set registry https://registry.npmmirror.com`；
- 安装 `tzdata`，并将 `/etc/localtime` 软链到 `/usr/share/zoneinfo/Asia/Shanghai`、`/etc/timezone` 写入 `Asia/Shanghai`，同时 `ENV TZ=Asia/Shanghai`。
- 非 CN 场景则跳过镜像切换与 tzdata 安装，保持镜像精简、时区使用默认（如需可手动覆盖 `TZ` 环境变量）。
- **密码注入**：生产 `wrangler.toml` 顶层无 `[vars]`（PASSWORD 仅在 `[env.dev.vars]`），故新建独立的 `wrangler.docker.toml`，顶层新增 `[vars] PASSWORD = "${APP_PASSWORD}"`，由 `docker-compose` 的 `environment` 注入，默认 `test1234`，完全不改动生产配置。

## 实现要点（执行细节）

- **构建缓存**：Dockerfile 先 `COPY package.json pnpm-lock.yaml*` 再 `npm install`，再 `COPY . .`（受 `.dockerignore` 控制），最大化利用层缓存。
- **信号传递**：`entrypoint.sh` 末尾用 `exec npx wrangler dev ...` 启动，确保容器能正确接收 SIGTERM 优雅停止。
- **关闭遥测**：设置 `WRANGLER_SEND_METRICS=false`，避免 `--local` 模式尝试联网上报。
- **健康检查**：`healthcheck` 用 `curl -f http://localhost:8787/admin.html` 探测，间隔 30s、超时 5s、重试 3 次。
- **构建上下文**：`docker-compose` 的 `build.context` 为项目根（`..`），故 `.dockerignore` 必须放在**项目根目录**，用于忽略 `.git`、`node_modules`、`.wrangler`、`images/`、`docs/` 等冗余与无关目录，避免拷贝膨胀、防止覆盖挂载数据。
- **向后兼容**：不修改任何现有源码与 `wrangler.toml`；新增文件全部位于 `docker/` 与根 `.dockerignore`，对线上部署零影响。

## 架构设计

单容器单服务结构（自上而下）：

- 宿主机部署目录 `./data` ← 挂载卷 → 容器内 `/app/data`
- 容器内 `wrangler dev --local --persist-to /app/data` 加载 `wrangler.docker.toml`（绑定 `DB`=D1、`ASSETS`=./dist）
- `index.js` 作为 Worker 处理 HTTP 请求，`env.DB` 指向持久化目录中的 SQLite

整体无额外中间件，结构清晰，后续可加 Nginx 反代、TLS 等而不动本方案。

## 目录结构

```
docker/
├── Dockerfile            # [NEW] 镜像构建文件。基于 node:22-bookworm-slim；ARG USE_CN_MIRROR 控制国内镜像与时区；
│                         #        安装 curl/ca-certificates/tzdata；拷贝 package.json→npm install→拷贝全量→拷贝
│                         #        entrypoint.sh 与 wrangler.docker.toml；创建 /app/data；EXPOSE 8787；ENTRYPOINT 指向脚本。
├── docker-compose.yml    # [NEW] 编排文件。build.context=..，build.args 传 USE_CN_MIRROR；ports 8787:8787；
│                         #        environment 传 APP_PASSWORD；volumes ./data:/app/data；restart unless-stopped；
│                         #        healthcheck 用 curl 探测 /admin.html。顶部注释说明用法。
├── entrypoint.sh         # [NEW] 启动脚本。export APP_PASSWORD/WRANGLER_SEND_METRICS；mkdir -p /app/data；
│                         #        exec npx wrangler dev --local --config /app/wrangler.docker.toml
│                         #        --ip 0.0.0.0 --port 8787 --persist-to /app/data --test-scheduled。
└── wrangler.docker.toml  # [NEW] 容器内专用配置。顶层 [vars] PASSWORD="${APP_PASSWORD}"；保留 main/
│                         #        compatibility_date/[assets]/[[d1_databases]](固定 database_id)；省略 crons。
.dockerignore             # [NEW] 放置于项目根（build context 为根）。忽略 .git、node_modules、.wrangler、
                          #        images、docs 等，仅保留运行所需文件。
```

## 关键代码结构

`docker/wrangler.docker.toml`（容器内专用，独立于生产配置）：

```
name = "serverless-qrcode-hub-docker"
main = "index.js"
compatibility_date = "2025-03-10"

[vars]
PASSWORD = "${APP_PASSWORD}"

[[d1_databases]]
binding = "DB"
database_name = "qrcode_hub"
# 固定 id 保证本地 SQLite 文件路径稳定，跨重启持久一致
database_id = "060f6d75-397d-4d39-b6b3-339b9224d6d7"

[assets]
directory = "./dist"
binding = "ASSETS"
```

`docker/Dockerfile` 国内镜像 + 时区切换核心片段：

```
ARG USE_CN_MIRROR=false
FROM node:22-bookworm-slim
ARG USE_CN_MIRROR
ENV TZ=Asia/Shanghai

# 启用国内镜像：apt 切阿里云、npm 切 npmmirror，并安装 tzdata 配置 Asia/Shanghai
RUN if [ "$USE_CN_MIRROR" = "true" ]; then \
      sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources; \
      npm config set registry https://registry.npmmirror.com; \
      apt-get update && apt-get install -y --no-install-recommends tzdata; \
      ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime; \
      echo "Asia/Shanghai" > /etc/timezone; \
    fi
```