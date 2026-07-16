# Project Memory

## serverless-qrcode-hub

- Cloudflare Workers 项目，使用 D1 数据库存储二维码映射，支持活码重定向。
- 后端单文件 `index.js`，前端 `dist/login.html` + `dist/admin.html`。
- 设计系统：`dist/theme.css`（专业商务风，覆盖 DaisyUI v5 主题变量）+ `dist/common.js`（首屏主题/切换/统一 Toast，登录页与后台共享）。
- 文档：`docs/CODE_DESIGN.md` 包含完整代码设计说明（架构、后端逐函数、前端逐模块、配置部署、安全优化建议）。
- 容器化部署：新增 `docker/` 目录（Dockerfile、docker-compose.yml、entrypoint.sh、wrangler.docker.toml）+ 项目根 `.dockerignore`。
  - 基于 `wrangler dev --local`（workerd 本地模式，离线、无需 Cloudflare 账号）运行；D1 数据通过 `--persist-to /app/data` 持久化到宿主机部署目录的 `./data`（含 `v3/d1/*.sqlite`）。
  - 构建参数 `USE_CN_MIRROR`（默认空/关闭）：为 `true` 时 apt 切阿里云、npm 切 npmmirror.com，并安装 tzdata 设置 `Asia/Shanghai` 时区。
  - 密码通过环境变量 `APP_PASSWORD`（默认 test1234）注入；`wrangler.docker.toml` 顶层 `[vars] PASSWORD="${APP_PASSWORD}"`，不改动生产 `wrangler.toml`。
  - 用法：`docker compose up -d --build`；国内：`USE_CN_MIRROR=true docker compose up -d --build`。
- 禁止随意 push，需用户明确确认。
