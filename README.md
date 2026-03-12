# DealHunter MVP

A local, containerized second-hand market aggregator for "power users" in DE and CZ.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (works on Apple Silicon M1/M2/M3)
- Node.js (v20+)

## Quick Start (Docker)

1.  **Start the services**:
    ```bash
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
# Start PocketBase via Docker
docker-compose up -d pocketbase

# Start App
npm install
npm run dev
```
