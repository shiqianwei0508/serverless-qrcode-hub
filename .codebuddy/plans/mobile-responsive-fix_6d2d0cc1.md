---
name: mobile-responsive-fix
overview: 全面修复 admin.html 移动端 UI 挤压问题：导航栏、搜索筛选区、表格操作按钮、模态框、间距等响应式适配。
todos:
  - id: fix-navbar
    content: 修复导航栏移动端布局：标题字号响应式、按钮紧凑化、超小屏换行
    status: completed
  - id: fix-search-filter
    content: 修复搜索筛选栏：超小屏筛选按钮改为纯图标、缩短 placeholder、减小间距
    status: completed
  - id: fix-table-actions
    content: 修复表格操作按钮：小屏改为纯图标按钮（编辑/删除/二维码/置顶），缩小操作列宽度
    status: completed
  - id: fix-modal-upload-pagination
    content: 修复模态框底部、上传区域 padding、分页栏的手机布局
    status: completed
  - id: fix-theme-responsive
    content: 补充 theme.css 超小屏响应式规则
    status: completed
    dependencies:
      - fix-navbar
      - fix-search-filter
      - fix-table-actions
      - fix-modal-upload-pagination
---

## 用户需求

手机访问 admin.html 时 UI 元素挤成一坨，需要优化移动端响应式布局。

## 核心问题

1. **导航栏**：品牌区和按钮区分别 `justify-center`，手机上各占一半宽度，标题文字过大挤占空间
2. **搜索筛选栏**：搜索框 + 清空按钮 + "全部/即将过期/已过期" 三个筛选按钮全部挤在一行，小屏（<380px）溢出
3. **表格操作列**：每行 4 个 `.join` 按钮（编辑/删除/二维码/置顶）在 sticky 的 150px 操作列中极窄，文字被挤压
4. **二维码模态框**：底部 checkbox + select + 下载按钮 + 关闭按钮 flex-wrap 后仍可能溢出
5. **上传区域**：`p-8` 在手机上过于宽大
6. **分页栏**：每页行数选择器 + 分页按钮在小屏上拥挤

## 技术方案

### 实现策略

修改 `dist/admin.html`（HTML 结构 + 内嵌 `<style>` 中的 `@media` 规则）和 `dist/theme.css`（补充移动端规则），不改动 JS 逻辑。

### 具体修改点

#### 1. 导航栏（admin.html lines 186-201）

- 外层容器移除 `md:justify-start` / `md:justify-end`，改为 `<768px` 时两侧自然排列
- h1 标题在小屏用 `text-lg` 替代 `text-xl`
- 按钮组用 `gap-1` + `btn-xs` 在小屏更紧凑
- 添加 `@media (max-width: 480px)`：navbar 改为 `flex-wrap`，品牌区和按钮区各占一行

#### 2. 搜索筛选栏（admin.html lines 327-361）

- 筛选按钮组（全部/即将过期/已过期）在 `<480px` 改为 `btn-xs` 且去掉文字仅保留图标
- 搜索框在小屏 `w-full`（已有），在 `<380px` 时 placeholder 缩短
- 整体容器移动端 `gap-2`

#### 3. 表格操作按钮（JS 中 createMappingRow / toggleEditMode / restoreRow）

- 在 `<640px` 时，操作按钮文字改为仅图标：
- 编辑: 铅笔 SVG
- 删除: 垃圾桶 SVG
- 二维码: QR 图标 SVG
- 置顶/取消: 图钉 SVG
- 通过内嵌 `<style>` 的 `@media (max-width: 640px)`：`.table-responsive .join .btn { padding: 0.25rem 0.4rem; font-size: 0; }` 隐藏文字；`.btn svg { width: 14px; height: 14px; }`
- 同时缩小操作列 `min-width` 从 150px 到 110px

#### 4. 二维码模态框（admin.html lines 144-161）

- `modal-action` 在小屏改为 `flex-col` 而非 `flex-wrap`
- 下载按钮和关闭按钮用 `w-full`

#### 5. 上传区域（admin.html line 256）

- `p-8` 改为 `p-4 sm:p-6 md:p-8`

#### 6. 分页栏（admin.html lines 405-419）

- 在小屏 `flex-col` 且每页行数选择器 + 分页按钮各占一行，`gap-2`

#### 7. theme.css 补充规则

- 新增 `@media (max-width: 480px)` 块覆盖超小屏场景

### 性能影响

纯 CSS 修改，无运行时开销。

### 涉及文件

- `dist/admin.html`：HTML 结构调整 + 内嵌 `<style>` 的 `@media` 规则扩展
- `dist/theme.css`：补充 `@media (max-width: 480px)` 规则