---
name: time-to-timestamp
overview: 将 expiry 和 created_at 的存储格式从日期字符串改为毫秒时间戳，前端按浏览器的本地时区自动展示日期，实现跨时区适配。
todos:
  - id: backend-migration
    content: 后端 index.js：添加数据迁移逻辑（initDatabase 中检测旧格式 expiry/created_at 并转为毫秒时间戳），修改表定义去掉 created_at DEFAULT
    status: completed
  - id: backend-sql-compare
    content: 后端 index.js：改造 getExpiringMappings、cleanupExpiredMappings、重定向过期判断中的 SQL 比较，从 datetime() 改为 CAST(expiry AS INTEGER) 数值比较
    status: completed
    dependencies:
      - backend-migration
  - id: backend-api
    content: 后端 index.js：修改 createMapping/updateMapping 的 expiry 校验与写入（date string→timestamp 转换，created_at=Date.now()），listMappings/getExpiringMappings 返回值 expiry 转 Number
    status: completed
    dependencies:
      - backend-migration
  - id: frontend-convert
    content: 前端 admin.html：添加 date-input 与 timestamp 互转逻辑，覆盖创建表单、行展示、编辑输入、保存提交、撤销恢复、过期判断共 6 处
    status: completed
  - id: docs-update
    content: 更新 docs/CODE_DESIGN.md：同步时间存储方案说明、过期判断逻辑、前端展示适配说明，更新版本快照哈希
    status: completed
    dependencies:
      - backend-api
      - frontend-convert
---

## 用户需求

将过期时间(expiry)和创建时间(created_at)的存储格式从日期字符串改为毫秒时间戳，前端自动适配不同系统时区。

## 核心功能

- **存储格式**：expiry 和 created_at 改为 13 位毫秒时间戳存储（SQLite TEXT 列存时间戳字符串）
- **创建/编辑流程**：前端 date input 选日期 → 转为本地当日 0 点时间戳 → 发送到后端存储
- **展示适配**：前端从后端拿到时间戳 → 用 `toLocaleDateString()` / `new Date(ts)` 在各自浏览器时区下展示，不同时区看到对应的当地时间
- **过期判断**：基于时间戳直接数值比较 `expiry < Date.now()`，Cloudflare Workers UTC 环境与浏览器的时区差异通过「时刻」语义正确处理
- **数据迁移**：首次部署时自动将已有 `YYYY-MM-DD` 格式的 expiry 和 `YYYY-MM-DD HH:MM:SS` 格式的 created_at 转换为毫秒时间戳

## 技术实现方案

### 实现策略

将时间从字符串存储全面切换为毫秒时间戳存储，利用 JS `Date` 对象在浏览器端自动处理本地时区，实现"一次存储、多时区适配"。

### 核心设计决策

**1. stored_at 生成时机**

- 原：依赖 SQL `DEFAULT CURRENT_TIMESTAMP`（UTC 文本）
- 新：JS 层 `Date.now()` 赋值写入，与 expiry 保持一致
- 理由：统一由 JS 控制，避免 SQL 层和 JS 层时区不一致

**2. expiry 时间戳语义**

- 用户选定的"日历日"：`new Date(input.value + 'T00:00:00').getTime()` → 本地当日 0 点时刻
- 比较时直接用数值：`expiry < Date.now()` → 达到该时刻即过期
- 展示时：`new Date(expiry).toLocaleDateString()` → 各时区看到自己本地日期

**3. SQL 比较改造**

- 原：`datetime(expiry) < datetime(?)` —字符串比较
- 新：`CAST(expiry AS INTEGER) < ?` —数值比较
- 原因：去 datetime() 包裹，直接按毫秒数值比较

**4. 数据迁移**

- 自动检测 expiry 是否仍然为 `YYYY-MM-DD` 格式（GLOB 模式匹配）
- 将旧格式 expiry 转为 UTC 0 点时间戳（`new Date(dateStr + 'T00:00:00Z').getTime()`）
- 将旧格式 created_at 转为 UTC 时间戳（`new Date(created_at.replace(' ','T') + 'Z').getTime()`）
- 通过批次 UPDATE 逐行转换，避免一次性大事务

**5. 前端 date input ↔ timestamp 转换工具函数**

- 输入转时间戳：`dateInputValue ? new Date(dateInputValue + 'T00:00:00').getTime() : null`
- 时间戳转展示文本：`ts ? new Date(ts).toLocaleDateString() : '永久有效'`
- 时间戳转 date input 值（本地日期）：手动组装 `getFullYear()-pad(getMonth()+1)-pad(getDate())`
- 原因：`toISOString().slice(0,10)` 返回 UTC 日期，不符合"本地日期回填"需求

### 架构影响

单文件 Worker 架构不变，改动集中在 `index.js` 和 `dist/admin.html`。前端零外部依赖。

### 性能与风险

- **时间复杂度**：数据迁移为 O(n) 逐行 UPDATE，n 为映射总数（通常 < 1000），性能无影响
- **兼容性**：迁移在 `initDatabase()` 中自动完成，首次部署后无需手动干预
- **回滚风险**：旧格式日期字符串无法还原为原始时区信息（丢失了原始的 admin 时区），但选择了"时刻"语义后，UTC 0 点作为历史数据的近似值是可接受的