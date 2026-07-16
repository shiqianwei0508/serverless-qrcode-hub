---
name: card-based-ui-refactor
overview: 将二维码列表从表格布局改为统一卡片布局（移动端+桌面端），新增只读详情模态框，编辑统一走模态框，移除表格相关代码。
design:
  architecture:
    framework: html
  styleKeywords:
    - 专业商务
    - 卡片网格
    - 简洁清爽
    - 圆角阴影
  fontSystem:
    fontFamily: PingFang SC
    heading:
      size: 20px
      weight: 600
    subheading:
      size: 14px
      weight: 500
    body:
      size: 13px
      weight: 400
  colorSystem:
    primary:
      - "#2563EB"
      - "#3b82f6"
    background:
      - "#ffffff"
      - "#f1f5f9"
    text:
      - "#0f172a"
      - "#475569"
    functional:
      - "#16a34a"
      - "#dc2626"
      - "#0ea5e9"
      - "#d97706"
todos:
  - id: add-detail-modal
    content: 在 admin.html 中添加详情模态框 HTML 结构（只读展示名称/短链名/URL/日期/状态，含编辑按钮）
    status: completed
  - id: replace-table-with-card-grid
    content: 替换 table 为卡片网格容器，移除表格标记和表头，添加卡片网格样式到 theme.css
    status: completed
  - id: rewrite-create-mapping-card
    content: 将 createMappingRow 重写为 createMappingCard，卡片内展示名称+状态+操作按钮组（含新增详情按钮）
    status: completed
    dependencies:
      - replace-table-with-card-grid
  - id: add-detail-modal-logic
    content: 实现 showDetailModal 函数，填充只读字段，内含编辑按钮打开现有编辑模态框
    status: completed
    dependencies:
      - add-detail-modal
      - rewrite-create-mapping-card
  - id: unify-edit-flow
    content: 移除 toggleEditMode/saveEdit/restoreRow，统一编辑入口为模态框
    status: completed
    dependencies:
      - rewrite-create-mapping-card
  - id: update-skeleton-and-cleanup
    content: 更新骨架屏为卡片骨架样式，清理废弃的表格 CSS 和编辑行逻辑
    status: completed
    dependencies:
      - replace-table-with-card-grid
---

## 产品概述

将管理面板从表格布局彻底改造为卡片网格布局，移动端和桌面端统一交互逻辑。卡片默认只显示条目名称、状态和操作按钮，点击详情按钮弹出只读详情模态框，内置编辑入口。

## 核心功能

- 卡片网格代替表格，移动端单列、平板 2 列、桌面 3 列
- 每张卡片展示：条目名称 + 状态徽章 + 操作按钮组（详情/编辑/删除/二维码/置顶）
- 新增只读详情模态框，展示全部字段，内含「编辑」按钮可跳转编辑模态框
- 编辑统一走模态框，移除桌面端行内编辑与移动端模态框的双轨逻辑
- 搜索、排序、分页、筛选等功能保持不变

## 技术方案

### 实现策略

在现有单文件架构基础上，将表格渲染逻辑替换为卡片渲染，新增详情模态框，统一编辑入口。

### 关键决策

- **卡片 DOM 结构**：用 `<div>` 网格容器 + 每个卡片一个 `<div class="mapping-card card">` 替代 `<table>/<tr>`，卡片内部用 flex 布局放置名称、状态、操作区
- **数据绑定**：沿用 `row.dataset.originalData` 的 JSON 序列化方式，改为 `card.dataset.originalData`
- **编辑统一**：移除 `toggleEditMode()` / `saveEdit()` / `restoreRow()`，所有编辑按钮直接打开 `#edit-modal`，保存成功后 `loadMappings()` 刷新列表
- **详情模态框**：新建 `#detail-modal`，通过 `showDetailModal()` 函数填充只读字段

### 性能

- 分页逻辑不变，每页最多 50 条，卡片渲染开销与表格行相当
- 卡片网格用 CSS Grid，无需 JS 计算尺寸

### 实现注意事项

- 删除 `#skeleton` 中的旧 table 骨架 HTML，改为卡片骨架
- 移除 `toggleEditMode()` 调用时注意 `openEditModal()` 不再需要 `row` 引用参数
- `saveEditFromModal()` 成功后移除 reload 改为 `loadMappings()`，避免整页刷新
- 保留 `currentEditOriginalData` 变量用于模态框编辑
- 桌面端按钮文字显示（`.btn-text`）保持现有逻辑，卡片宽度足够则显示文字

## 设计风格

延续现有专业商务风设计系统，卡片化增强视觉层次感。卡片采用圆角阴影卡片样式，与现有 card 组件保持一致。网格布局自适应，移动端更清爽。

## 卡片设计

每张卡片顶部为条目名称（加粗），下方为状态徽章行（启用/禁用/微信/置顶），底部为操作按钮组。按钮组采用 join 样式，桌面显示文字+图标，移动仅图标。

## 详情模态框

只读信息分区展示：名称、短链名、目标URL、过期日期，以及状态开关（显示但不可交互）。底部操作栏：编辑按钮（打开编辑模态框）+ 关闭按钮。

## 响应式

- 移动端 <640px：单列卡片
- 平板 640-1024px：双列
- 桌面 >1024px：三列