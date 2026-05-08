# 🎯 SecondScout

A high-performance second-hand market aggregator built for power users. SecondScout allows you to search across multiple platforms simultaneously (Czech Republic & Germany), filtering out noise and flagging potential scams.

![Version](https://img.shields.io/badge/version-0.6.1-blue)
![License](https://img.shields.io/badge/license-MIT-green)
[![Netlify Status](https://api.netlify.com/api/v1/badges/your-badge-id/deploy-status)](https://app.netlify.com/teams/nightguarder-agent/projects)

## ✨ Features

- **Cross-Platform Search**: Search across multiple marketplaces in one go:
  - 🇨🇿 **Czech Republic**: Bazos.cz, Sbazar.cz, Cyklobazar.cz, Aukro.cz
  - 🇩🇪 **Germany**: Kleinanzeigen.de
- **Advanced Filtering**: 
  - Support for negative keywords (e.g., `iphone 15 -pro -max`)
  - Multi-word AND logic (all keywords must match)
  - Automatic noise reduction (filters accessories when searching for devices)
  - Model mismatch detection (won't show "Max" when you search for "Pro")
  - Automatic category detection based on keywords
- **Anti-Scam Protection**: Automatically flags listings from known scammers using data from `podvodynabazaru.cz`
- **Watchers**: Set up automated searches that run in the background
- **Image Proxy**: Bypasses hotlink protection to ensure all item images load correctly

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- PocketBase instance (local or hosted)

### Local Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/nightguarder-agent/SecondScout.git
   cd SecondScout
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your PocketBase URL and credentials:
   ```
   PB_ADMIN_EMAIL=your_email@domain.com
   PB_ADMIN_PASSWORD=your_password
   PUBLIC_POCKETBASE_URL=http://127.0.0.1:8090
   CRON_SECRET=your_random_secret_here
   ```

4. **Start PocketBase** (if running locally):
   - Download from [pocketbase.io](https://pocketbase.io/download)
   - Run: `./pocketbase serve`
   - Open `http://127.0.0.1:8090/_/` to create admin account

5. **Run the development server**:
   ```bash
   npm run dev
   ```
   App will be available at `http://localhost:5173`

## 📖 Documentation & Roadmap

- See [DOCS.md](DOCS.md) for technical details on architecture and scrapers
- See [ROADMAP.md](ROADMAP.md) for planned features and progress
- See [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) for recent changes

## 🛠️ Tech Stack

- **Frontend**: Svelte 5 (Runes), Tailwind CSS v4, TypeScript
- **Backend**: SvelteKit (API routes)
- **Database**: PocketBase (SQLite)
- **Scraping**: Axios, Cheerio
- **Deployment**: Netlify (automatic on push)

## ☁️ Deployment

The app is automatically deployed to **Netlify** when changes are pushed to the `main` branch.

- **Frontend**: [Netlify](https://app.netlify.com/teams/nightguarder-agent/projects)
- **Backend (PocketBase)**: Hosted on [Pockethost.io](https://pockethost.io) or private VPS

### Manual Deployment
```bash
# Commits are automatically deployed via Netlify
git add .
git commit -m "Your changes"
git push origin main
```

## 🔧 Project Structure

```
src/
├── lib/
│   ├── server/
│   │   ├── scraper/          # Scraper logic
│   │   │   ├── impl/         # Individual provider scrapers
│   │   │   └── anti_scam/    # Anti-scam service
│   │   ├── scraper.ts        # Main search orchestration
│   │   ├── watcher.ts        # Watcher execution logic
│   │   └── pocketbase.ts     # PocketBase client
├── routes/
│   ├── api/                  # API endpoints
│   └── watchers/             # Watcher management UI
```

## 🎯 Search Tips

- **Negative keywords**: Use `-` to exclude terms: `macbook air m1 -broken -damaged`
- **Multi-word matching**: All words must appear: `garmin edge 530` won't match just "garmin"
- **Category detection**: Keywords like "iphone" auto-detect electronics category on Bazos

---
> [!TIP]
> **Pro Tip**: Combine negative keywords with specific models: `iphone 15 pro -max -plus -broken`
