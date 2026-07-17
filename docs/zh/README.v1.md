# serverless-qrcode-hub

> English documentation: [README.v1.md](../../README.v1.md)

苦于微信群聊二维码频繁变动，开发这个能生成永久二维码的工具，**不需要服务器**。基于 Cloudflare Workers 和 KV 存储实现。

> ⚠️ 本文档为**旧版（基于 KV 的 v1.2.0）**说明，仅作历史参考与升级指引保留。当前推荐使用基于 D1 存储的新版，详见 [README.md](../README.md)。

## 功能特性

- 🔗 生成永久短链接，指向微信群二维码
- 😋 可当短链接生成器
- ☁️ 无需服务器
- 🎨 自定义二维码样式和 Logo
- 💻 管理后台可随时更新
- 🔐 密码保护

<a href="https://qrdemo.2020818.xyz" target="_blank">Demo 地址</a>(密码: `demo`)

## 预览图

- 登录

  ![preview-login](../../images/preview-login.png)

- 管理后台1：添加普通短链

  ![preview-admin](../../images/preview-admin.png)

- 管理后台2：添加微信二维码

  ![preview-admin2](../../images/preview-admin2.png)

- 管理后台3

  ![preview-admin3](../../images/preview-admin3.png)

- 生成二维码

  ![preview-qr](../../images/preview-qr.png)

- 管理后台4：编辑

  ![preview-admin4](../../images/preview-admin4.png)

- 微信识别

  ![preview-wechat](../../images/preview-wechat.jpg)

- 短链跳转就不展示了，是直接跳转的

## 使用步骤

1. 登录 Cloudflare 并创建 KV 命名空间

   ![](../../images/1.jpg)

2. 复制 KV 命名空间 ID

   ![](../../images/2.jpg)

3. 回到 GitHub 并 Fork 仓库

   ![](../../images/3.png)

4. 在 GitHub 打开你 Fork 的仓库的 `wrangler.toml` 文件，点击图中的按钮编辑

   ![](../../images/4.jpg)

5. 将 `kv_namespaces` 下的 `id` 内容替换为你的 KV 命名空间 ID

   ![](../../images/5.jpg)

6. 回到 Cloudflare 并创建 Worker

   ![](../../images/6.jpg)

7. 选择你 Fork 的 Github 仓库，然后直接点击右下角的 `保存并部署`

   ![](../../images/7.jpg)

8. 等待部署成功，自动跳转到了这个页面，此时默认分配的 `*.workers.dev` 域名在国内访问较慢，建议绑定自己的域名

   ![](../../images/8.jpg)

9. 绑定自定义域名

   ![](../../images/9.jpg)

10. 设置一个你在 Cloudflare 托管的域名的子域名

    ![](../../images/10.jpg)

11. 按图中步骤设置访问密码，注意密码格式为英文字母和数字，尽量长尽量复杂，推荐使用两段随机生成的uuid字符串作为密码

    ![](../../images/11.png)

12. 部署成功，此时已经可以面板上通过默认分配的 `*.workers.dev` 或者你自定义的域名访问了！

13. 访问并登录后，创建短链接例子

    ![](../../images/12.png)
    ![](../../images/13.png)

14. 创建微信群聊活码例子

    ![](../../images/14.png)
    ![](../../images/15.png)

## TODO

- [ ] 实现定时检查过期短链功能
  - [x] 自动检查过期的短链接
  - [ ] 发送邮件通知管理员
  - [x] 自动清理过期数据
- [ ] 添加访问统计功能
- [ ] 支持批量导入导出
- [ ] 支持多租户
- [ ] 支持多语言
- [ ] 支持多 Serverless 平台
- [ ] 手机端快捷更新二维码功能

欢迎提交 Issue 和 Pull Request！
