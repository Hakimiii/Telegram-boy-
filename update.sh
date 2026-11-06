#!/usr/bin/env bash
# آپدیت ربات بعد از تغییر کد روی گیت‌هاب:  bash update.sh
set -e
cd "$(dirname "$0")"
git pull
npm install --no-audit --no-fund
npm run build || true
pm2 restart telegram-bot
pm2 status
