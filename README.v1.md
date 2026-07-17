# serverless-qrcode-hub

> 中文文档: [docs/zh/README.v1.md](./docs/zh/README.v1.md)

Tired of WeChat group QR codes changing constantly, I built this tool to generate permanent QR codes — **no server required**. Built on Cloudflare Workers and KV storage.

> ⚠️ This is the documentation for the **old KV-based version (v1.2.0)**. It is kept for historical reference and upgrade guidance. The current recommended version uses D1 storage — see [README.md](./README.md).

## Features

- 🔗 Generate permanent short links that point to WeChat group QR codes
- 😋 Can also be used as a short-link generator
- ☁️ No server required
- 🎨 Customizable QR styles and logo
- 💻 Admin panel for updating links anytime
- 🔐 Password protection

<a href="https://qrdemo.2020818.xyz" target="_blank">Demo</a> (password: `demo`)

## Screenshots

- Login

  ![preview-login](./images/preview-login.png)

- Admin panel 1: add a normal short link

  ![preview-admin](./images/preview-admin.png)

- Admin panel 2: add a WeChat QR code

  ![preview-admin2](./images/preview-admin2.png)

- Admin panel 3

  ![preview-admin3](./images/preview-admin3.png)

- Generate a QR code

  ![preview-qr](./images/preview-qr.png)

- Admin panel 4: edit

  ![preview-admin4](./images/preview-admin4.png)

- WeChat recognition

  ![preview-wechat](./images/preview-wechat.jpg)

- (Short-link redirects are not shown — they redirect directly.)

## Setup steps

1. Log in to Cloudflare and create a KV namespace

   ![](./images/1.jpg)

2. Copy the KV namespace ID

   ![](./images/2.jpg)

3. Go back to GitHub and fork the repository

   ![](./images/3.png)

4. In GitHub, open the `wrangler.toml` file of your forked repo and click the edit button shown in the image

   ![](./images/4.jpg)

5. Replace the `id` under `kv_namespaces` with your KV namespace ID

   ![](./images/5.jpg)

6. Go back to Cloudflare and create a Worker

   ![](./images/6.jpg)

7. Select your forked GitHub repository, then click `Save and Deploy` at the bottom right

   ![](./images/7.jpg)

8. Wait for the deployment to succeed. You will be redirected to this page automatically. The default `*.workers.dev` domain assigned is slow to access in mainland China, so it is recommended to bind your own domain

   ![](./images/8.jpg)

9. Bind a custom domain

   ![](./images/9.jpg)

10. Set a subdomain of a domain you host on Cloudflare

    ![](./images/10.jpg)

11. Set the access password following the steps in the image. Note that the password format is English letters and numbers, as long and complex as possible. It is recommended to use two randomly generated UUID strings as the password

    ![](./images/11.png)

12. Deployment succeeded. You can now access it from the panel via the default `*.workers.dev` domain or your custom domain!

13. After accessing and logging in, create a short link (example)

    ![](./images/12.png)
    ![](./images/13.png)

14. Create a WeChat group live-code example

    ![](./images/14.png)
    ![](./images/15.png)

## TODO

- [ ] Implement scheduled check for expired short links
  - [x] Automatically check expired short links
  - [ ] Send email notification to admin
  - [x] Automatically clean up expired data
- [ ] Add visit statistics
- [ ] Support batch import/export
- [ ] Support multi-tenancy
- [ ] Support multi-language
- [ ] Support multiple Serverless platforms
- [ ] Mobile quick-update QR feature

Issues and Pull Requests are welcome!
