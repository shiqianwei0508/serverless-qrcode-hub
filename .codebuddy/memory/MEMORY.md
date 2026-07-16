# Project Memory

## serverless-qrcode-hub

- Cloudflare Workers 项目，使用 D1 数据库存储二维码映射，支持活码重定向。
- 后端单文件 `index.js`，前端 `dist/login.html` + `dist/admin.html`。
- 设计系统：`dist/theme.css`（专业商务风，覆盖 DaisyUI v5 主题变量）+ `dist/common.js`（首屏主题/切换/统一 Toast，登录页与后台共享）。
- 文档：`docs/CODE_DESIGN.md` 包含完整代码设计说明（架构、后端逐函数、前端逐模块、配置部署、安全优化建议）。
- 禁止随意 push，需用户明确确认。
