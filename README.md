# 🎯 SecondScout

A high-performance second-hand market aggregator (Bazos & more) built for power users. SecondScout allows you to search across multiple platforms simultaneously, filtering out noise and flagging potential scams.

## ✨ Features

- **Cross-Platform Search**: Search Bazos.cz, Sbazar.cz, Cyklobazar.cz, and Aukro.cz in one go.
- **Advanced Filtering**: 
    - Support for negative keywords (e.g., `iphone 15 -pro`).
    - Automatic noise reduction (filters accessories like covers/cases when searching for devices).
    - Model mismatch detection (e.g., won't show "Max" when you search for "Pro").
- **Anti-Scam Protection**: Automatically flags listings from known scammers using data from `podvodynabazaru.cz`.
- **Watchers**: Set up automated searches that run in the background and notify you of new deals.
- **Image Proxy**: Bypasses hotlink protection to ensure all item images load correctly.

## 🚀 Quick Start (Docker)

1.  **Clone & Start**:
    ```bash
    cd backend
    docker-compose up -d
    ```
    This will start:
    -   **PocketBase** at `http://127.0.0.1:8090`
    -   **Web App** at `http://127.0.0.1:5173`

2.  **Configure PocketBase**:
    -   Open `http://127.0.0.1:8090/_/`
    -   Login with the credentials defined in `backend/docker-compose.yml`.
    -   Create collections: `watchers`, `scam_reports`, `scammers`.

3.  **Use the App**:
    -   Go to `http://127.0.0.1:5173`.
    -   Start searching!

## 📖 Documentation & Roadmap

- See [DOCS.md](DOCS.md) for technical details on architecture and scrapers.
- See [ROADMAP.md](ROADMAP.md) for planned features, including Kleinanzeigen support.

## 🛠️ Tech Stack

- **Svelte 5** (Runes)
- **Tailwind CSS v4**
- **SvelteKit**
- **PocketBase** (SQLite)
- **TypeScript**
- **Axios & Cheerio** (Scraping)

## ☁️ Deployment

The app is optimized for deployment on **Netlify** or **Vercel** for the frontend, and **Pockethost.io** or a private VPS for PocketBase.

---
> [!TIP]
> **Pro Search**: Use the minus sign `-` to exclude terms. Example: `macbook air m1 -broken -damaged`.
