# Project Memory

## serverless-qrcode-hub

- Cloudflare Workers 项目，使用 D1 数据库存储二维码映射，支持活码重定向。
- 后端已轻量拆分：`index.js`（入口/路由/鉴权/接口分发）+ `src/state.js`（共享运行时状态 `DB`/`KV_BINDING` + `initState()`，用 ES module live binding 跨模块共享）+ `src/util.js`（`escapeHtml`）+ `src/db.js`（数据层：建表迁移、CRUD、输入校验、`banPath`、KV 迁移）+ `src/pages.js`（公开页 `PUBLIC_I18N`/`pickLang`/`renderExpiredPage`/`renderWechatPage`）。`wrangler` 部署时 esbuild 将 `src/*` 打包为单 Worker，运行行为等价于原单文件。前端 `dist/login.html` + `dist/admin.html`。
- 设计系统：`dist/theme.css`（专业商务风，覆盖 DaisyUI v5 主题变量）+ `dist/common.js`（首屏主题/切换/统一 Toast，登录页与后台共享）。
- 多语言：共享引擎 `dist/i18n.js`（字典 `DICT` + `t()` / `detectLang()` / `applyI18n()` / `setLang()` / `createLangSwitcher()`）。支持 en/zh/ru/ja/ko/es/fr/de 共 8 种语言，`en` 为默认值与回退；静态文案用 `data-i18n*` 属性，动态内容用 `I18N.t('admin.*'/'app.*'/'login.*')`。访客端公开页（过期/微信活码）由 `index.js` 的 `PUBLIC_I18N` + `pickLang(request)` 处理（回落英文，并对 `name` 做 `escapeHtml`）。
- 文档：`docs/CODE_DESIGN.md` 含完整英文代码设计说明；`docs/zh/CODE_DESIGN.md` 为中文版。双语约定：**英文在规范路径，中文在 `docs/zh/`**（如 `README.md` + `docs/zh/README.md`、`README.v1.md` + `docs/zh/README.v1.md`）。从 `docs/zh/` 链接根目录文件用 `../../`。所有文档更新须中英同步。
- 容器化部署：新增 `docker/` 目录（Dockerfile、docker-compose.yml、entrypoint.sh、wrangler.docker.toml）+ 项目根 `.dockerignore`。
  - 基于 `wrangler dev --local`（workerd 本地模式，离线、无需 Cloudflare 账号）运行；D1 数据通过 `--persist-to /app/data` 持久化到宿主机部署目录的 `./data`（含 `v3/d1/*.sqlite`）。
  - 构建参数 `USE_CN_MIRROR`（默认空/关闭）：为 `true` 时 apt 切阿里云、npm 切 npmmirror.com，并安装 tzdata 设置 `Asia/Shanghai` 时区。
  - 密码通过环境变量 `APP_PASSWORD`（默认 test1234）注入；`wrangler.docker.toml` 顶层 `[vars] PASSWORD="${APP_PASSWORD}"`，不改动生产 `wrangler.toml`。
  - 用法：`docker compose up -d --build`；国内：`USE_CN_MIRROR=true docker compose up -d --build`。
- **git push 由用户自己手动在合适时间执行，AI 助手一律不碰 push**（不要主动询问是否 push，也不要执行 push 命令）。可以正常 `git add` / `git commit`，但 push 完全交给用户。
