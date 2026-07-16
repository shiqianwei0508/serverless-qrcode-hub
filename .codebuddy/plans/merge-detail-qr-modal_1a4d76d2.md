---
name: merge-detail-qr-modal
overview: "将卡片上的\"详情\"和\"二维码\"两个按钮合并为一个\"详情\"按钮，把二维码预览区域嵌入到详情弹窗下半部分，同时删除独立的 #qr-modal 和相关 JS 函数。"
todos:
  - id: remove-qr-modal-html
    content: "删除 #qr-modal HTML 结构（line 56-89）"
    status: completed
  - id: extend-detail-modal
    content: "扩展 #detail-modal：在状态徽章下方插入分割线 + 二维码容器 + URL 输入框 + 样式选项 + 下载按钮"
    status: completed
    dependencies:
      - remove-qr-modal-html
  - id: merge-qr-into-detail
    content: 重写 showDetailModal()：内联 generateQRForMapping 的二维码生成/下载逻辑，在 showModal() 前执行
    status: completed
    dependencies:
      - extend-detail-modal
  - id: remove-qr-button-and-function
    content: 删除 createMappingCard 中 .btn-qr 按钮 HTML 和事件绑定；删除 generateQRForMapping() 函数
    status: completed
    dependencies:
      - merge-qr-into-detail
---

## 需求概述

将卡片条目中的"详情"和"二维码"两个按钮合并为一个"详情"按钮，点击后在一个统一的弹窗中同时展示元数据和二维码。

## 核心变更

- 卡片按钮从 5 个减为 4 个：详情、编辑、删除、置顶（移除独立的"二维码"按钮）
- 删除独立的 `#qr-modal`，把二维码区域（图片 + logo开关 + 样式选择 + 下载）嵌入 `#detail-modal` 下半部分
- 将 `generateQRForMapping()` 的二维码生成逻辑合并到 `showDetailModal()` 中

## 技术栈

- 前端：原生 HTML + JS，Tailwind CSS v4 + DaisyUI v5
- 二维码库：qr-code-styling.js（CDN 引入，已存在）
- 修改范围：仅 `dist/admin.html` 单文件

## 实现方案

### 整体策略

删除独立的二维码弹窗和按钮，将二维码渲染逻辑内嵌到详情弹窗中。详情弹窗上半部分保持元数据展示（名称/短链名/URL/有效期/状态），下半部分追加分割线 + 二维码区域。

### 具体改动点

**1. 删除独立 `#qr-modal`（line 56-89）**
移除整个 `<dialog id="qr-modal">` 及其内部 HTML 结构。

**2. 扩展 `#detail-modal`（line 107-147）**
在状态徽章区域 (`</div>` 关闭标签后) 和 `modal-action` 之间插入二维码区域：

- 分割线 `<div class="divider my-4">二维码</div>`
- 二维码容器 `<div id="qr-container" class="flex justify-center mb-3"></div>`
- 链接地址输入框 `<input id="qr-url" class="input input-bordered w-full mb-3" readonly>`
- 底部操作栏：logo 开关 + 样式选择 + 下载按钮

注意：元素 id 保持与原来一致（`qr-container`、`qr-url`、`qr-show-logo`、`qr-dots-style`、`qr-download`），避免改动 CSS 选择器和 `localStorage` 键名。

**3. 修改 `createMappingCard()`（line 944-1001）**

- 移除 `.btn-qr` 按钮 HTML（line 981-984）
- 移除 `.btn-qr` 事件绑定（line 997）
- 卡片 `join` 组件从 5 个按钮变为 4 个

**4. 重写 `showDetailModal()`（line 1003-1031）**
将 `generateQRForMapping()` 的二维码生成逻辑内联到函数末尾，在 `showModal()` 之前执行：

- 获取 `qr-container`、`qr-download`、`qr-url`、`qr-show-logo`、`qr-dots-style` 元素
- 清空容器，设置 URL 输入框值
- 从 `localStorage` 恢复用户偏好设置
- 创建 `QRCodeStyling` 实例并 `append` 到容器
- 绑定 `updateQRCode`（logo 切换、样式切换、localStorage 持久化）
- 绑定下载按钮点击事件

**5. 删除 `generateQRForMapping()` 函数（line 889-942）**
该函数逻辑已合并到 `showDetailModal()`，不再需要独立存在。

### 注意事项

- CSS 中 `#qr-container canvas` 和 `#qr-container.switching` 样式保持不变，元素 id 不变
- `localStorage` 键名 `qr-show-logo` / `qr-dots-style` 保持不变
- 卡片按钮响应式 CSS（`.btn-icon`/`.btn-text`）无需修改，减少一个按钮后自动适配
- `showDetailModal` 的 `path` 参数用于 URL 拼接逻辑