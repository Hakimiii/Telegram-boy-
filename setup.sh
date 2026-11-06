#!/usr/bin/env bash
# نصب و اجرای ربات روی سرور اوبونتو — فقط یک بار اجرا کن:  bash setup.sh
set -e
cd "$(dirname "$0")"

echo "=== ۱/۶ نصب ابزارهای لازم ==="
sudo apt-get update -y
sudo apt-get install -y python3 ffmpeg curl ca-certificates git

# حافظه مجازی (برای اینکه ساخت پروژه روی سرور کم‌رم قطع نشود)
if [ "$(free -m | awk '/Swap/{print $2}')" -lt 1000 ]; then
  echo "ساخت swap دو گیگ..."
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

echo "=== ۲/۶ نصب Node.js و pm2 ==="
if ! command -v node >/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
command -v pm2 >/dev/null || sudo npm install -g pm2

echo "=== ۳/۶ نصب پکیج‌های پروژه (چند دقیقه طول می‌کشد) ==="
chmod +x bin/yt-dlp
npm install --no-audit --no-fund
npm run build || echo "هشدار: ساخت داشبورد ناموفق بود؛ ربات تلگرام بدون آن هم کار می‌کند."

echo "=== ۴/۶ توکن ربات ==="
if [ -f .botenv ]; then
  . ./.botenv
fi
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
  read -r -p "توکن ربات را paste کن و Enter بزن: " TELEGRAM_BOT_TOKEN
fi
if [ -z "$INSTAGRAM_SESSION_ID" ] && [ ! -f .botenv ]; then
  read -r -p "sessionid اینستاگرام (اختیاری؛ اگر نداری فقط Enter بزن): " INSTAGRAM_SESSION_ID
fi
printf "TELEGRAM_BOT_TOKEN='%s'\nINSTAGRAM_SESSION_ID='%s'\n" "$TELEGRAM_BOT_TOKEN" "$INSTAGRAM_SESSION_ID" > .botenv
chmod 600 .botenv
for f in .botenv ecosystem.config.cjs; do grep -qxF "$f" .gitignore 2>/dev/null || echo "$f" >> .gitignore; done

TELEGRAM_BOT_TOKEN="$TELEGRAM_BOT_TOKEN" INSTAGRAM_SESSION_ID="$INSTAGRAM_SESSION_ID" APPDIR="$(pwd)" node -e '
const fs = require("fs");
const env = { NODE_ENV: "production", PORT: "3000", TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN };
if (process.env.INSTAGRAM_SESSION_ID) env.INSTAGRAM_SESSION_ID = process.env.INSTAGRAM_SESSION_ID;
const cfg = { apps: [{ name: "telegram-bot", script: "npm", args: "start", cwd: process.env.APPDIR, env, autorestart: true, max_restarts: 50, restart_delay: 5000 }] };
fs.writeFileSync("ecosystem.config.cjs", "module.exports = " + JSON.stringify(cfg, null, 2) + ";\n");
fs.chmodSync("ecosystem.config.cjs", 0o600);
'

echo "=== ۵/۶ اجرای ربات ==="
pm2 delete telegram-bot >/dev/null 2>&1 || true
pm2 start ecosystem.config.cjs
pm2 save

echo "=== ۶/۶ روشن‌شدن خودکار بعد از ری‌استارت سرور ==="
sudo env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$USER" --hp "$HOME" >/dev/null 2>&1 || true
pm2 save

echo
echo "در حال بررسی (۱۵ ثانیه)..."
sleep 15
STATUS=$(pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const p=JSON.parse(s).find(x=>x.name==="telegram-bot");console.log(p?p.pm2_env.status:"none")}catch(e){console.log("unknown")}})')
ME=$(curl -s --max-time 15 "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe" || true)
echo "وضعیت pm2: $STATUS"
echo "پاسخ تلگرام: $ME"
echo
if [ "$STATUS" = "online" ]; then
  echo "✅ ربات روشن است. داخل تلگرام /start بزن."
else
  echo "❌ ربات روشن نشد. این خروجی را برای من بفرست:"
  pm2 logs telegram-bot --lines 30 --nostream
fi
