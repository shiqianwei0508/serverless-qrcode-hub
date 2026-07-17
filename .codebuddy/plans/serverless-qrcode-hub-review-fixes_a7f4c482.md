---
name: serverless-qrcode-hub-review-fixes
overview: 针对上一轮整体评审的 9 项问题一次性修复：实现真正的过期数据清理、HMAC 签名 Cookie（由 PASSWORD 派生）、qrCodeData 格式白名单+长度上限、死代码清理、initDatabase 记忆化、文案/定时注释对齐、微信活码与普通链接拆分为两个独立功能、banPath 去重同步、生产密码来源注释，并同步更新中英文文档。
todos:
  - id: hmac-cookie
    content: 实现 HMAC 签名鉴权 Cookie（由 PASSWORD 派生，修改 src/util.js 与 index.js）
    status: completed
  - id: real-cleanup
    content: scheduled 真正调用 cleanupExpiredMappings 删除过期记录，保留日志报告
    status: completed
  - id: qrcode-validate
    content: db.js 增加 qrCodeData 白名单与 1MB 长度校验，pages.js 渲染转义
    status: completed
  - id: code-hygiene
    content: initDatabase 记忆化、移除 KV_BINDING/migrateFromKV、banPath 单一来源、合并 expiry 校验
    status: completed
    dependencies:
      - hmac-cookie
  - id: split-modal
    content: admin.html 添加/编辑拆为微信活码与普通链接两套独立流程，i18n 补 key
    status: completed
    dependencies:
      - qrcode-validate
  - id: docs-sync
    content: 同步中英文 README/CODE_DESIGN，修正 cron 与日志文案，wrangler.toml 加密码注释
    status: completed
    dependencies:
      - real-cleanup
      - code-hygiene
---

## 用户需求

基于上一轮整体评审，一次性修复全部 9 项问题，提升项目准确性、安全性与可维护性。

## 产品概述

对 serverless-qrcode-hub（Cloudflare Workers + D1 二维码短链平台）进行一轮缺陷修复与加固：实现真正的过期数据清理、把明文密码 Cookie 改为 HMAC 签名令牌、增加二维码数据格式与大小校验、统一文案与定时任务描述、清理死代码与重复逻辑、将"微信活码添加"与"普通链接添加"拆分为两个独立功能，并同步修正中英文文档。

## 核心功能

- 定时任务真正物理删除过期记录，同时保留即将过期/已过期的日志报告。
- 鉴权 Cookie 改为 `issuedAt.HMAC` 签名令牌（密钥由 PASSWORD 派生），不再明文装载密码。
- 入库前校验 qrCodeData 必须为 `data:image/` 或 `https?://` 且长度 ≤1MB；公开页渲染时对 URL 做转义。
- 添加/编辑弹窗拆分为"微信活码"与"普通链接"两个独立流程，各自展示对应控件与必填校验。
- 修正 README/TODO 中 cron 与日志文案的失实描述，统一为"每天 02:00、3 天窗口"。
- 清理未启用的 KV_BINDING/migrateFromKV 死代码，去除重复的 expiry 校验与 banPath 副本，initDatabase 增加一次性记忆化。
- wrangler.toml 增加生产密码来源注释；中英文文档同步更新。

## 技术栈

- 运行环境：Cloudflare Workers（esbuild 打包 `src/*` 为单 Worker）、D1 数据库、Workers Assets 托管 `dist/`。
- 语言：JavaScript（ES Modules），Web Crypto（`crypto.subtle`）用于 HMAC。
- 前端：`dist/admin.html` + `dist/login.html`，共享 `dist/theme.css`、`dist/common.js`、`dist/i18n.js`（DaisyUI v5 主题 + 8 语言）。
- 文档：英文在规范路径，中文在 `docs/zh/`，更新须中英同步，回链用 `../../`。

## 实现方案

### 1. 过期数据真正清理（问题 #1）

在 `index.js` 的 `scheduled` 中，现有报告逻辑保留，额外调用 `cleanupExpiredMappings()` 物理删除 `expiry < now` 的记录；删除前后各打印计数日志。不改动其"先报告后删除"结构。README/TODO 维持"已自动清理"表述不变（与代码对齐）。

### 2. HMAC 签名鉴权 Cookie（问题 #3）

引入 `src/auth.js`（或并入 util 模块）实现：

- `signToken(secret, issuedAt)`：`crypto.subtle.importKey` + HMAC-SHA256(`issuedAt + ':' + secret`)。
- `setAuthCookie`：写入 `auth=issuedAt.<sig>; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`。
- `verifyAuthCookie`：拆分 `issuedAt.sig`，重算 HMAC 比对，且 `now - issuedAt ≤ 86400000`。`secret` 由 `env.PASSWORD` 派生（直接用作 HMAC key），不新增环境变量，避免部署配置漂移。
- 旧明文 Cookie 自动失效（格式不符即拒），无迁移负担。

### 3. qrCodeData 格式与大小校验（问题 #4）

在 `src/db.js` 的 `validateMappingInput` 内新增：当 `isWechat` 为真，`qrCodeData` 必须以 `data:image/` 或 `https://`/`http://` 开头，且 `length ≤ 1_048_576`（约 1MB，D1 单行安全上限）。`createMapping`/`updateMapping` 入库前再校验一次。前端 `renderWechatPage` 对 `qrCodeData` 经 `escapeHtml` 后拼入 `src`（纵深防御）。

### 4. 文案与定时描述对齐（问题 #2）

- `index.js:287` 日志改为 "expiring in 3 days"。
- `README.md`/`docs/zh/README.md` 将 cron 描述改为"每天 02:00 触发（cron `0 2 */1 * *` = 每日）"，窗口说明为 3 天。
- `README.v1.md` TODO 维持 `[x] Automatically clean up expired data` 不变（与 #1 一致）。

### 5. 代码卫生（问题 #5/#6/#8/#9）

- `initDatabase()` 用模块级 `let dbInitialized` 记忆化，`fetch`/`scheduled` 仍 `await`（幂等且只跑一次）。
- 移除未启用的 `KV_BINDING`（`src/state.js` 与 `migrateFromKV` 一并删除，因 `wrangler.toml` 无 `[kv_namespaces]`，运行期为 undefined），消除误导。
- `banPath` 以 `src/db.js:10` 为唯一来源；`dist/admin.html` 内联副本改为读取后端下发的保留名单（或加注释"必须与 src/db.js 保持一致"）。
- 合并 `validateMappingInput` 与 `createMapping`/`updateMapping` 中重复的 expiry NaN 校验，统一在 `validateMappingInput` 完成。
- `wrangler.toml` 在 `[env.dev.vars]` PASSWORD 上方加注释：生产环境 PASSWORD 由 Cloudflare 后台 Variables 注入，裸 `wrangler deploy` 需先在后台配置。

### 6. 添加/编辑弹窗拆分（问题 #7）

在 `dist/admin.html` 将"新建"入口拆为两个按钮/标签页：

- **普通链接**：仅 path/target/name/expiry/enabled，无二维码控件。
- **微信活码**：path/name/expiry/enabled + 二维码上传（复用 `dist/common.js` 的 FileReader→dataURL 逻辑），`qrCodeData` 必填。
编辑弹窗按当前记录 `isWechat` 决定展示哪套控件：微信记录显示上传框（可重传），普通记录隐藏。提交时按类型走对应校验分支，避免 WECHAT_REQUIRES_QR 误报。新增 i18n key（如 `admin.addWechat`/`admin.addLink`/`admin.qrRequired`）在 `dist/i18n.js` 及中文补充。

## 实现注意事项

- HMAC 在 Workers 运行时 `crypto.subtle` 可用；`importKey` 为异步，相关函数须 `async`。
- 删除 `KV_BINDING` 前确认 `migrateFromKV` 之外无其它引用（search 已确认无）。
- 前端二维码 dataURL 超大时后端会在 `validateMappingInput` 拦截并返回明确错误，前端 Toast 提示。
- 所有改动保持 esbuild 打包后单 Worker 行为不变；不引入新依赖。

## 架构与目录结构

```
## 修改/新增文件清单
index.js                  # [MODIFY] scheduled 调用 cleanupExpiredMappings；日志"3 days"；verifyAuthCookie/setAuthCookie 改用 HMAC 签名令牌
src/db.js                 # [MODIFY] banPath 唯一来源；validateMappingInput 增加 qrCodeData 白名单+长度与 expiry 统一校验；清理 KV_BINDING 相关；保留 cleanupExpiredMappings
src/state.js              # [MODIFY] 移除 KV_BINDING 导出与初始化
src/util.js               # [MODIFY] 新增 hmacSign/hmacVerify（或置于新 src/auth.js）
src/pages.js              # [MODIFY] renderWechatPage 对 qrCodeData 做 escapeHtml
dist/admin.html           # [MODIFY] banPath 改为引用后端名单+注释；添加/编辑弹窗拆分为微信活码/普通链接两套独立流程与校验
dist/i18n.js              # [MODIFY] 新增拆分模式相关 i18n key（en+7 语言）
dist/common.js            # [MODIFY] 复用/抽取二维码上传(dataURL)公共函数
wrangler.toml             # [MODIFY] [env.dev.vars].PASSWORD 上方加生产密码来源注释
README.md                 # [MODIFY] 修正 cron 与定时清理文案（英文）
README.v1.md              # [MODIFY] TODO 已清理描述保持一致
docs/zh/README.md         # [MODIFY] 同步中文文案修正
docs/CODE_DESIGN.md       # [MODIFY] 同步：移除 KV_BINDING/migrateFromKV、Cookie HMAC、qrCodeData 校验、banPath 单一来源、initDatabase 记忆化
docs/zh/CODE_DESIGN.md    # [MODIFY] 同步中文设计文档
docs/zh/deployment.md     # [MODIFY] 如需说明生产密码来源，同步注释
```

## 关键代码结构

```js
// src/auth.js（或并入 util.js）
// 密钥由 env.PASSWORD 派生，HMAC-SHA256
async function hmacSign(message, secret) // -> base64url 字符串
async function verifyAuthToken(token, secret) // -> boolean：拆分 issuedAt.sig，比对签名且 issuedAt 在 86400000ms 内

// Cookie 形态：auth=<issuedAt>.<sig>
```