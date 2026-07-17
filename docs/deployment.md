# Deployment

> 中文文档: [docs/zh/deployment.md](../deployment.md)

This project can be run in three ways:

1. **Cloudflare Cloud Deployment** — deploy to Cloudflare Workers + D1 (production / online).
2. **Docker Container** — run fully offline inside a container, with D1 data persisted to a mounted volume (any Docker host, e.g. a Linux server).
3. **Local Offline Development** — run directly on your machine with `wrangler dev --local`; no Docker and no Cloudflare account required (ideal for Windows / macOS / Linux dev).

## Prerequisites (for local methods)

- Node.js 22+ and pnpm (this repo uses pnpm).
- wrangler 4 (installed automatically via `pnpm install` as a devDependency).
- For the Docker method: Docker + Docker Compose v2.

---

## 1. Cloudflare Cloud Deployment (online)

Requires a Cloudflare account. D1 data lives in Cloudflare's managed SQLite.

### 1.1 Configure

1. Create a D1 database in the Cloudflare dashboard and copy its `database_id`.
2. In `wrangler.toml`:
   - Replace the `database_id` under the top-level `[[d1_databases]]` (production database `qrcode_hub`) with **your** D1 id.
   - (Optional, only if you use the `dev` environment) replace the `database_id` under `[[env.dev.d1_databases]]` as well.
3. Set the admin password as a **secret**. The production config has **no** plaintext password in `wrangler.toml`:

   ```bash
   wrangler secret put PASSWORD
   ```

   > The `dev` environment uses the plaintext `PASSWORD` from `[env.dev.vars]` (defaults to `test1234`).

### 1.2 Deploy

```bash
pnpm install
wrangler login          # one-time browser authentication
npm run deploy          # -> wrangler deploy (production, top-level config)
```

- The Worker name is `serverless-qrcode-hub-dev`. It must match the CI expectation, otherwise you will see a `Failed to match Worker name` warning and CI will override it.
- Access the admin panel at `https://<your-subdomain>.workers.dev/admin.html` (or your custom domain). The login password is the secret you set in step 1.3.

### 1.3 Remote development (optional)

To run against the **remote** D1 database (requires `wrangler login` and an existing D1 instance):

```bash
npm run dev             # -> wrangler dev --env dev --test-scheduled
```

### 1.4 Automatic deployment

Pushing to GitHub triggers Cloudflare Workers Builds, which runs `pnpm install --frozen-lockfile` then `npx wrangler deploy` automatically. See `README.md` for the full walkthrough.

---

## 2. Docker Container (offline)

Runs `wrangler dev --local` inside a container with workerd — **no Cloudflare account, fully offline**. D1 data is stored in a local SQLite file and persisted to the host via a mounted volume.

### 2.1 Run

From the **project root**:

```bash
# Default (overseas mirror sources)
docker compose -f docker/docker-compose.yml up -d --build

# China mirror (Aliyun apt + npmmirror npm + Asia/Shanghai timezone)
USE_CN_MIRROR=true docker compose -f docker/docker-compose.yml up -d --build

# Custom admin password
APP_PASSWORD=yourpass docker compose -f docker/docker-compose.yml up -d --build
```

- Exposes port `8787`. Admin UI: `http://<host>:8787/admin.html`
- Default password: `test1234` (override with the `APP_PASSWORD` environment variable).

### 2.2 Data & operations

- D1 data persists to the host `./data` directory (mounted to `/app/data`), surviving container restarts and image rebuilds.
- Health check: `curl -f http://localhost:8787/admin.html` (interval 30s, timeout 5s, retries 3).
- View logs: `docker compose -f docker/docker-compose.yml logs -f`
- Stop: `docker compose -f docker/docker-compose.yml down`
- Rebuild after code changes: `docker compose -f docker/docker-compose.yml up -d --build`

### 2.3 Files

`docker/Dockerfile`, `docker/docker-compose.yml`, `docker/entrypoint.sh`, `docker/wrangler.docker.toml` (container-only config with a top-level `[vars] PASSWORD="${APP_PASSWORD}"`), and the root `.dockerignore`.

---

## 3. Local Offline Development (no Docker, no account)

Run directly on your machine with `wrangler dev --local`. D1 uses a local SQLite file; no Cloudflare account or remote database is required.

```bash
pnpm install
npm run dev:local     # -> wrangler dev --local --env dev --test-scheduled --ip 0.0.0.0 --port 8787
```

- Admin UI: `http://localhost:8787/admin.html`
- Default password: `test1234` (from `[env.dev.vars]` in `wrangler.toml`).
- The D1 database is auto-created on the first request by `initDatabase()` (`CREATE TABLE IF NOT EXISTS`) and lives in `.wrangler/state/v3/d1/`, persisting across restarts.
- The first run downloads the workerd runtime binary (needs internet **once**); afterwards it runs fully offline.
- Requires Node.js 22+ (same major version as the Docker base image).

---

## Comparison

| Method | Cloudflare account | Docker | Data store | Best for |
|--------|-------------------|--------|------------|----------|
| Cloudflare cloud (`npm run deploy`) | Required | No | Cloudflare D1 (remote) | Production / public hosting |
| Docker container | Not required | Required | Local SQLite (`./data`) | Self-hosted server, offline |
| Local dev (`npm run dev:local`) | Not required | Not required | Local SQLite (`.wrangler`) | Daily development on your PC |
