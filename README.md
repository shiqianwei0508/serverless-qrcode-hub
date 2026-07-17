# serverless-qrcode-hub

> 中文文档: [docs/zh/README.md](./docs/zh/README.md)

Tired of WeChat group QR codes changing constantly, I built this tool to generate permanent QR codes — **no server required**. It is built on Cloudflare Workers and D1.

> The old version used KV, whose free quota was too small. The new version uses D1 storage instead (50 million reads is more than enough). If you are still on the old version, please upgrade. The last KV-based version is v1.2.0: [README.v1.md](./README.v1.md) (no longer recommended).
>
> Guide for migrating from the old KV version to the new one: [MIGRATE.md](./MIGRATE.md)

## Acknowledgments

This project is a fork/enhancement built on top of [xxnuo/serverless-qrcode-hub](https://github.com/xxnuo/serverless-qrcode-hub) — the original, serverless WeChat-group live-code / short-link tool by [@xxnuo](https://github.com/xxnuo), built on Cloudflare Workers + D1 (Apache-2.0 licensed, latest release v2.0.1).

**Special thanks to xxnuo** for creating and openly sharing the original project. This repository adds several enhancements on that foundation: HMAC-signed auth cookies, real expired-data cleanup, split WeChat-QR / normal-link creation flows, Docker/offline deployment, and 8-language i18n.

## Features

- 🔗 Generate permanent short links that point to WeChat group QR codes
- 😋 Can also be used as a short-link generator
- ☁️ No server required
- 🎨 Customizable QR styles and logo
- 💻 Admin panel for updating links anytime
- 🔐 Password protection
- 🌐 Multi-language UI (English, 中文, Русский, 日本語, 한국어, Español, Français, Deutsch)

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

1. Log in to Cloudflare and create a D1 SQL database

   ![](./images/1_1.png)
   ![](./images/1_2.png)

2. Copy the D1 SQL database ID

   ![](./images/2_1.png)

3. Go back to GitHub and fork the repository

   ![](./images/3.png)

4. In GitHub, open the `wrangler.toml` file of your forked repo and click the edit button shown in the image

   ![](./images/4_1.png)

5. Replace the `database_id` under `d1_databases` with your own copied D1 SQL database ID

   ![](./images/5_1.png)

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

## Automatic deployment (Cloudflare Workers Builds)

This project is configured with Cloudflare Workers Builds. After pushing code to GitHub, it will automatically pull from the repository and build & deploy — no manual operation required. Key information extracted from a real build log:

- **Build environment**: `pnpm@10.11.1`, `nodejs@22.16.0`
- **Dependency install**: `pnpm install --frozen-lockfile` (see `pnpm-lock.yaml`; keep the lock file up to date)
- **Deploy command**: `npx wrangler deploy` (currently using `wrangler 4.0.0`)
- **Database binding**: D1 database `qrcode_hub` (configured in `wrangler.toml`'s `d1_databases`)
- **Scheduled task**: `schedule: 0 2 */1 * *` (production cron runs daily at 02:00; the handler reports soon-to-expire / already-expired links within a 3-day window **and physically deletes expired records**)
- **Static assets**: admin panel `dist/admin.html` is published together with the Worker via the `assets` config

> ⚠️ **The Worker name must match what CI expects**: The CI system matches the deployment target by Worker name. If the `name` in `wrangler.toml` does not match what CI expects, the build log will show a warning and be overridden by CI:
> ```
> [WARNING] Failed to match Worker name. Your config file is using the Worker name "xxx", but the CI system expected "yyy". Overriding using the CI provided Worker name.
> ```
> This repository has set `wrangler.toml`'s `name` to `serverless-qrcode-hub-dev`, matching CI's expectation (deployment address: `https://<your-subdomain>.workers.dev`). After forking, please modify this `name` according to the Worker name you created on Cloudflare to avoid the warning.

## Other deployment options

Besides the Cloudflare cloud workflow above, this project also supports running fully offline via Docker, or directly on your machine with `wrangler dev --local`. See [docs/deployment.md](./docs/deployment.md) for all three methods (Cloudflare cloud / Docker / local offline dev).

Issues and Pull Requests are welcome!
