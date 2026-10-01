# PIMS – Pharmaceutical Inventory Management System

Production-oriented React + Express + MySQL architecture for pharmacy inventory management and seasonal demand forecasting.

## Services

| Service | Stack | Description |
|---------|-------|-------------|
| `client` | React 19 + Vite + TailwindCSS | Modern web frontend for pharmacists and administrators |
| `server` | Node.js + Express + MySQL (`mysql2/promise`) | REST API, JWT auth, seasonal demand forecasting, and cron alert jobs |

## Prerequisites

- **Node.js** ≥ 18
- **MySQL** ≥ 8.0 (Local MySQL Server or Cloud RDS/Aiven instance)

---

### Quick Launch (Local Development)

Simply run from the project root:

```bash
npm start
```

This will:
- Automatically check and free required ports (`5000`, `5173`)
- Launch the **Backend Server** (port 5000) and **Frontend Client** (port 5173) concurrently with colored prefix logs
- Automatically open `http://localhost:5173` in your default browser

To stop all running services cleanly:
```bash
npm run stop
```

---

### Manual Launch

#### 1. Configure environment variables

```bash
cp .env.example .env
```

Set required variables in `.env`:
- `MYSQL_HOST` – MySQL host (default: `127.0.0.1`)
- `MYSQL_PORT` – MySQL port (default: `3306`)
- `MYSQL_USER` – MySQL user (default: `root`)
- `MYSQL_PASSWORD` – MySQL password
- `MYSQL_DATABASE` – MySQL database (default: `pims`)
- `JWT_ACCESS_SECRET` – 64-character hex secret (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- `JWT_REFRESH_SECRET` – a different 64-character hex secret
- `CLIENT_URL` – `http://localhost:5173` (or deployed Vercel frontend URL)

#### 2. Initialize Database & Seed

```bash
cd server
npm run seed
```

#### 3. Start services

```bash
# Terminal 1 – Express backend
cd server && npm run dev

# Terminal 2 – React frontend
cd client && npm run dev
```

The React app will be available at **http://localhost:5173**.

---

## Cloud Deployment (Vercel + Render)

### 1. Frontend Deployment (Vercel)
- **Framework Preset**: Vite
- **Root Directory**: `client`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Environment Variables**:
  - `VITE_API_URL`: `https://<your-render-backend-name>.onrender.com`

### 2. Backend Deployment (Render - Web Service)
- **Environment**: Node
- **Root Directory**: `server`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Environment Variables**:
  - `NODE_ENV`: `production`
  - `MYSQL_HOST`: `<your-mysql-host>`
  - `MYSQL_PORT`: `3306`
  - `MYSQL_USER`: `<your-mysql-user>`
  - `MYSQL_PASSWORD`: `<your-mysql-password>`
  - `MYSQL_DATABASE`: `pims`
  - `JWT_ACCESS_SECRET`: `64_char_hex_secret`
  - `JWT_REFRESH_SECRET`: `different_64_char_hex_secret`
  - `JWT_ACCESS_EXPIRY`: `15m`
  - `JWT_REFRESH_EXPIRY`: `7d`
  - `CLIENT_URL`: `https://<your-vercel-app>.vercel.app`

---

## Running Tests

```bash
# Run all test suites
npm run test:all --prefix server

# Run core integration test suite
npm test --prefix server

# Run OTP & Credential generation verification suite
npm run test:otp --prefix server

# Demand forecasting integration suite
node server/src/tests/forecasting_integration.test.js

# Atomic inventory concurrency suite
npm run test:concurrency --prefix server
```

---

## Relational Database Tables (MySQL)

Managed via `server/src/config/schema.sql` and DAL:
- `pharmacies` – Multi-tenant workspace registry
- `users` – User accounts per pharmacy workspace
- `staff` – Employee directory, roles, and sales tracking
- `otps` – Bcrypt-hashed purpose-based verification tokens with automated TTL cleanup
- `medicines` – Medicine catalog and ATC category mapping
- `inventories` – Stock batches with expiry tracking
- `transactions` – Sales and stock-in ledger
- `alerts` – LOW_STOCK, OVERSTOCK, and EXPIRY_WARNING notifications
- `predictions` – Forecast history
- `user_preferences` – Per-user notification settings
- `support_tickets` – Help & Support submissions

---

## Architecture

```
client (React 19 / Vite) → server (Express / MySQL / Seasonal Forecasting)
                                     ↓
                          Background cron job (alert evaluation)
```

- **Multi-tenant Isolation**: Each pharmacy is strictly isolated by `pharmacy_id` on all database queries and tables.
- **Concurrency-safe Sells**: Atomic row locks (`SELECT ... FOR UPDATE`) and transactional decrement ensure non-negative stock under high concurrency without deadlocks.
- **Seasonal Demand Forecasting**: Directly calculates forecasted demand by applying monthly seasonal demand factors across 8 WHO ATC medicine categories scaled by pharmacy sales baselines.
- **Prediction Replenishment Alerts**: Automated `LOW_STOCK` alerts generated when active stock falls below recommended safety levels.
