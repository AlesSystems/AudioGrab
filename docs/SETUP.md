# AudioGrab — Setup Guide

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18+ |
| yt-dlp | latest |
| ffmpeg | 4.x+ |

### Install yt-dlp

**macOS (Homebrew)**
```bash
brew install yt-dlp
```

**Linux (apt)**
```bash
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
```

### Install ffmpeg

**macOS (Homebrew)**
```bash
brew install ffmpeg
```

**Linux (apt)**
```bash
sudo apt update && sudo apt install -y ffmpeg
```

Verify both are on your PATH:

```bash
yt-dlp --version
ffmpeg -version
```

---

## Local Development

### 1. Clone the repository

```bash
git clone https://github.com/your-org/audiograb.git
cd audiograb
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example env file and fill in values:

```bash
cp .env.example .env.local
```

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_FILE_SIZE_MB` | `200` | Maximum upload size in megabytes |
| `TEMP_DIR` | `/tmp/audiograb` | Directory for ephemeral working files |
| `DEFAULT_BITRATE` | `192` | Default MP3 bitrate (128 / 192 / 320) |

### 4. Start the dev server

```bash
npm run dev
```

The app is available at `http://localhost:3000`. The API route lives at `POST /api/extract`.

---

## Deployment

### Frontend → Vercel

The Next.js frontend deploys to Vercel with no additional configuration.

1. Push the repository to GitHub/GitLab.
2. Import the project in the Vercel dashboard.
3. Set the same environment variables from the table above under **Project Settings → Environment Variables**.
4. Deploy.

> **Important:** Vercel serverless functions have CPU-time and response-size limits that `ffmpeg` will exceed for any non-trivial video. The API route (`/api/extract`) must run on a long-lived server process.

### Backend (full app with ffmpeg) → Railway / Render / Fly

Because `yt-dlp` and `ffmpeg` must be present in the runtime environment, deploy the full Next.js app (or the API layer separately) to **Railway**, **Render**, or **Fly.io** using a Dockerfile.

#### Sample Dockerfile

```dockerfile
FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]
```

Point your Railway/Render service to this Dockerfile. Set the same environment variables in the platform's dashboard.

> **Note on YouTube blocking:** Cloud hosts are frequently blocked by YouTube. For reliable extraction use Vimeo URLs, direct `.mp4` links, or the file-upload endpoint. Consider rotating cookies or a residential proxy only on dedicated infrastructure if YouTube support is required.
