# 🎯 DealHunter

A high-performance second-hand market aggregator (Bazos & more) built for power users.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (works on Apple Silicon M1/M2/M3)
- Node.js (v20+)

## Quick Start (Docker)

1.  **Clone & Start**:
    ```bash
    cd backend
    docker-compose up -d
    ```
    This will start:
    -   **PocketBase** at `http://127.0.0.1:8090` (Admin: `ENV.PB_ADMIN_EMAIL` / `ENV.PB_ADMIN_PASSWORD`)
    -   **Web App** at `http://127.0.0.1:5173`

2.  **Configure PocketBase**:
    -   Open `http://127.0.0.1:8090/_/`
    -   Login with the credentials above (automatically created).
    -   Create a new collection named `watchers` with the following fields:
        -   `keywords` (Text)
        -   `max_price` (Number)
        -   `region` (Select: Options `DE`, `CZ`)
        -   **Important**: Do NOT check "Present" for any relations initially. The backend handles this as admin.

3.  **Use the App**:
    -   Go to `http://127.0.0.1:5173`.
    -   Select your market (DE or CZ).
    -   Search for items (Mock data will be returned).
    -   Add a **Watcher** to monitor a search.

4.  **Run Watchers (Simulation)**:
    -   Go to `http://127.0.0.1:5173/watchers`.
    -   Click "Run Watchers Now".

## Technical Setup & Troubleshooting

### Data Persistence
-   Data is persisted in `./pb_data` which is mounted to `/pb_data` inside the container.
-   **Note**: The default image `ghcr.io/muchobien/pocketbase` uses `/pb_data`, distinct from the standard `/usr/local/bin/pb_data`.
- ghcr.io/muchobien/pocketbase:latest	


### Authentication
-   The SvelteKit backend authenticates as an **Admin** using environment variables (`PB_ADMIN_EMAIL`, `PB_ADMIN_PASSWORD`) defined in `docker-compose.yml`.
-   This allows the app to write to the `watchers` collection even if API rules are set to "Admin only" (default).

### Known Issues / Fixes during Dev
-   **500 Error on Watcher Create**: Caused by sending invalid string data to a Relation field (`user`). The current version omits the user relation until a real auth system is implemented.
-   **Login Failure**: If you cannot log in, ensure the volume is mounted correctly and `PB_ADMIN_...` env vars are set. You may need to `rm -rf pb_data` to reset state if moving between image versions.

## Development

To run locally for testing purposes:
    ```bash
    PUBLIC_POCKETBASE_URL=http://127.0.0.1:8090
    PB_ADMIN_EMAIL=your_email
    PB_ADMIN_PASSWORD=your_password
    CRON_SECRET=your_random_secret
    ```

## ☁️ Deployment (Free Tier)

### 1. Database (PocketBase)
Host for free on [Pockethost.io](https://pockethost.io/). 
- Set `PUBLIC_POCKETBASE_URL` in your prod environment to your Pockethost URL.

### 2. Frontend (SvelteKit)
Deploy to **Vercel** or **Netlify** (Free Tiers).
- **Vercel**: Automatically uses `vercel.json` for 30min Cron Jobs.
- **Netlify**: Use an external pinger (like `cron-job.org`) to hit `/api/cron?cron_secret=...` every 30 mins.

## 🛠️ Built With
- **Svelte 5** (Runes)
- **Tailwind CSS v4**
- **PocketBase** (SQLite backend)
- **Vite 7**

---
> [!TIP]
> **Scraping Note**: Ensure your `CRON_SECRET` is set in production to prevent unauthorized scraper triggers!

