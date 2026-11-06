FROM node:22-slim

# Install system dependencies: ffmpeg, ca-certificates, python3 (for yt-dlp)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    python3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency definitions
COPY package.json ./

# Install npm dependencies
RUN npm install

# Copy application source code
COPY . .

# Ensure yt-dlp binary has executable permissions
RUN chmod +x bin/yt-dlp 2>/dev/null || true

# Build static frontend assets
RUN npm run build

# Expose port (default 3000)
ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000

# Healthcheck endpoint for 24/7 uptime monitoring
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/ping || exit 1

# Start the continuous server
CMD ["npm", "start"]
