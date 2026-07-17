# 部署文档

> 英文文档: [docs/deployment.md](../deployment.md)

本项目有三种运行方式：

1. **Cloudflare 云端部署** —— 部署到 Cloudflare Workers + D1（生产 / 在线）。
2. **Docker 容器部署** —— 在容器内完全离线运行，D1 数据持久化到挂载卷（任意装有 Docker 的宿主机，例如 Linux 服务器）。
3. **本机离线开发** —— 直接用 `wrangler dev --local` 在本地运行，无需 Docker，也无需 Cloudflare 账号（适合 Windows / macOS / Linux 日常开发）。

## 前置条件（本地类方式）

- Node.js 22+ 与 pnpm（本仓库使用 pnpm）。
- wrangler 4（执行 `pnpm install` 后会作为 devDependency 自动安装）。
- Docker 方式还需：Docker + Docker Compose v2。

---

## 1. Cloudflare 云端部署（在线）

需要 Cloudflare 账号。D1 数据存放在 Cloudflare 托管的 SQLite 中。

### 1.1 配置

1. 在 Cloudflare 控制台创建一个 D1 数据库，并复制其 `database_id`。
2. 修改 `wrangler.toml`：
   - 将顶层 `[[d1_databases]]`（生产库 `qrcode_hub`）下的 `database_id` 替换成**你自己的** D1 id。
   - （可选，仅当你使用 `dev` 环境时）将 `[[env.dev.d1_databases]]` 下的 `database_id` 也一并替换。
3. 将后台登录密码设置为**密钥**。生产配置在 `wrangler.toml` 中**没有**明文密码：

   ```bash
   wrangler secret put PASSWORD
   ```

   > `dev` 环境使用的是 `[env.dev.vars]` 里的明文 `PASSWORD`（默认为 `test1234`）。

### 1.2 部署

```bash
pnpm install
wrangler login          # 一次性浏览器登录授权
npm run deploy          # -> wrangler deploy（生产，使用顶层配置）
```

- Worker 名称为 `serverless-qrcode-hub-dev`。它必须与 CI 期望的名称一致，否则会出现 `Failed to match Worker name` 警告并被 CI 覆盖。
- 访问后台：`https://<你的子域名>.workers.dev/admin.html`（或你的自定义域名）。登录密码即第 1.3 步设置的密钥。

### 1.3 远程开发（可选）

如需连接**远端** D1 数据库进行开发（需 `wrangler login` 且 D1 实例已存在）：

```bash
npm run dev             # -> wrangler dev --env dev --test-scheduled
```

### 1.4 自动部署

推送到 GitHub 会触发 Cloudflare Workers Builds，自动执行 `pnpm install --frozen-lockfile` 然后 `npx wrangler deploy`。完整流程见 `README.md`。

---

## 2. Docker 容器部署（离线）

在容器内用 workerd 运行 `wrangler dev --local` —— **无需 Cloudflare 账号，完全离线**。D1 数据写入本地 SQLite 文件，并通过挂载卷持久化到宿主机。

### 2.1 运行

在**项目根目录**下执行：

```bash
# 默认（海外镜像源）
docker compose -f docker/docker-compose.yml up -d --build

# 国内镜像（阿里云 apt + npmmirror npm + Asia/Shanghai 时区）
USE_CN_MIRROR=true docker compose -f docker/docker-compose.yml up -d --build

# 自定义后台密码
APP_PASSWORD=yourpass docker compose -f docker/docker-compose.yml up -d --build
```

- 对外暴露端口 `8787`。后台地址：`http://<宿主机>:8787/admin.html`
- 默认密码：`test1234`（可用 `APP_PASSWORD` 环境变量覆盖）。

### 2.2 数据与运维

- D1 数据持久化到宿主机的 `./data` 目录（挂载到 `/app/data`），容器重启或镜像重建后数据不丢。
- 健康检查：`curl -f http://localhost:8787/admin.html`（间隔 30s、超时 5s、重试 3 次）。
- 查看日志：`docker compose -f docker/docker-compose.yml logs -f`
- 停止：`docker compose -f docker/docker-compose.yml down`
- 代码变更后重建：`docker compose -f docker/docker-compose.yml up -d --build`

### 2.3 相关文件

`docker/Dockerfile`、`docker/docker-compose.yml`、`docker/entrypoint.sh`、`docker/wrangler.docker.toml`（容器专用配置，含顶层 `[vars] PASSWORD="${APP_PASSWORD}"`），以及项目根目录的 `.dockerignore`。

---

## 3. 本机离线开发（无需 Docker，无需账号）

直接用 `wrangler dev --local` 在本地运行。D1 使用本地 SQLite 文件，既不需要 Cloudflare 账号，也不需要远端数据库。

```bash
pnpm install
npm run dev:local     # -> wrangler dev --local --env dev --test-scheduled --ip 0.0.0.0 --port 8787
```

- 后台地址：`http://localhost:8787/admin.html`
- 默认密码：`test1234`（来自 `wrangler.toml` 的 `[env.dev.vars]`）。
- D1 数据库在首次请求时由 `initDatabase()`（`CREATE TABLE IF NOT EXISTS`）自动建表，存放于 `.wrangler/state/v3/d1/`，重启后保留。
- 首次运行会下载 workerd 运行时二进制（**仅需联网一次**），之后即可完全离线运行。
- 需要 Node.js 22+（与 Docker 基础镜像版本一致）。

---

## 方式对比

| 方式 | 需要 Cloudflare 账号 | 需要 Docker | 数据存储 | 适用场景 |
|------|---------------------|------------|----------|----------|
| Cloudflare 云端（`npm run deploy`） | 需要 | 不需要 | Cloudflare D1（远端） | 生产 / 公网托管 |
| Docker 容器 | 不需要 | 需要 | 本地 SQLite（`./data`） | 自托管服务器、离线 |
| 本机开发（`npm run dev:local`） | 不需要 | 不需要 | 本地 SQLite（`.wrangler`） | 本机日常开发 |
