#!/usr/bin/env bash
set -e

# 默认管理员密码，可通过环境变量 APP_PASSWORD 覆盖
export APP_PASSWORD="${APP_PASSWORD:-test1234}"

# 关闭 wrangler 遥测上报，避免 --local 模式尝试联网
export WRANGLER_SEND_METRICS=false

# 确保数据目录存在（即使未挂载外部卷也不会报错）
mkdir -p /app/data

echo "=========================================="
echo " serverless-qrcode-hub (local mode)"
echo " D1 data dir : /app/data"
echo " Admin UI    : http://<host>:8787/admin.html"
echo "=========================================="

# 以本地模式离线运行 workerd，D1 数据持久化到 /app/data
exec npx wrangler dev \
  --local \
  --config /app/wrangler.docker.toml \
  --ip 0.0.0.0 \
  --port 8787 \
  --persist-to /app/data \
  --test-scheduled
