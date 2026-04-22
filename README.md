# 🎯 SecondScout

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

### Netlify Deployment
1. Create a Netlify account and add your site
2. Connect your GitHub repository
3. In Build settings:
   - Build command: `npm run build:netlify`
   - Publish directory: `dist`
4. Set environment variables in Netlify dashboard:
   - `PB_ADMIN_EMAIL`
   - `PB_ADMIN_PASSWORD`
   - `PUBLIC_POCKETBASE_URL`
   - `CRON_SECRET`
   - `NETLIFY_BUILD_TIMEOUT` (optional)
   - `NETLIFY_BUILD_MAXRETRY` (optional)
5. Deploy site

### Cron Jobs on Netlify
Netlify Functions are available at `/.netlify/functions/*`. The cron function is available at `/.netlify/functions/cron` and requires the `CRON_SECRET` environment variable.

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
- **Vercel**: Automatically uses `vercel.json` for daily Cron Jobs.
- **Netlify**: 
  - Deploy using `netlify.toml` configuration
  - Use Netlify Functions for API endpoints
  - Set environment variables in Netlify UI (not in .env files)
  - **Cron Jobs**: Use an external pinger (like `cron-job.org` or `uptimerobot.com`) to hit `/api/cron?cron_secret=YOUR_SECRET` daily

### Netlify-specific setup:
1. Environment variables (set in Netlify UI > Site settings > Build & deploy > Environment):
   - `PB_ADMIN_EMAIL`
   - `PB_ADMIN_PASSWORD`
   - `PUBLIC_POCKETBASE_URL`
   - `CRON_SECRET`
   
2. Build settings:
   - Build command: `npm run build:netlify`
   - Publish directory: `svelte-kit/adapter-netlify`

3. Cron Jobs Setup:
   - Netlify doesn't support traditional cron jobs. Use an external pinger service:
     - [cron-job.org](https://cron-job.org/) (free tier available)
     - [UptimeRobot](https://uptimerobot.com/) (free tier available)
     - [EasyCron](https://easycron.com/) (free tier available)
   
   - Configure the pinger to hit: `https://your-site.netlify.dev/.netlify/functions/api-cron?cron_secret=YOUR_CRON_SECRET`
   
   - The Netlify Function in `functions/api-cron.js` handles the cron execution securely by verifying the CRON_SECRET

4. Functions Setup:
   - Netlify Functions are in the `functions/` directory
   - Install function dependencies with: `npm run build:netlify` (this copies dependencies)
   - Functions are automatically detected and deployed with your site

5. Alternative backend deployment:
   - If you need a backend server, consider separate hosting:
     - AWS EC2
     - DigitalOcean Droplet
     - Railway
     - Fly.io
   - Or use PocketBase Cloud for a managed solution

## 🛠️ Built With
- **Svelte 5** (Runes)
- **Tailwind CSS v4**
- **PocketBase** (SQLite backend)
- **Vite 7**

---
> [!TIP]
> **Scraping Note**: Ensure your `CRON_SECRET` is set in production to prevent unauthorized scraper triggers!

