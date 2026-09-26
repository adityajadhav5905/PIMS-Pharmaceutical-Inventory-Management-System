# PIMS – Pharmaceutical Inventory Management System

Production-oriented React + Express + FastAPI microservice architecture for pharmacy inventory forecasting and management.

## Services

| Service | Stack |
|---------|-------|
| `client` | React 18 + Vite + TailwindCSS |
| `server` | Node.js + Express + MongoDB (Mongoose) + JWT auth + cron alert jobs |
| `ml-service` | FastAPI + Uvicorn (prediction endpoint with graceful statistical fallback) |

## Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.11
- **MongoDB** ≥ 6.0 (running locally or via Docker)

### Quick Launch

Simply run from the project root:

```bash
npm start
```

This will:
- Automatically check and free required ports (`5000`, `5173`, `8000`)
- Launch the **Backend Server** (port 5000), **Frontend Client** (port 5173), and **ML Prediction Service** (port 8000) concurrently with colored prefix logs
- Automatically open `http://localhost:5173` in Google Chrome (or default browser)

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

Edit `.env` and set at minimum:
- `MONGODB_URI` – MongoDB connection string (e.g., `mongodb://127.0.0.1:27017/pims`)
- `JWT_ACCESS_SECRET` – a 64-char hex secret (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- `JWT_REFRESH_SECRET` – a different 64-char hex secret
- `ML_SERVICE_URL` – `http://localhost:8000` for local dev

### 2. Install dependencies

```bash
# React client
cd client && npm install

# Express server
cd ../server && npm install

# FastAPI ML service
cd ../ml-service && pip install -r requirements.txt
```

### 3. Start services

```bash
# Terminal 1 – Express backend
cd server && npm run dev

# Terminal 2 – React frontend
cd client && npm run dev

# Terminal 3 – FastAPI ML service (optional, falls back to statistical model if offline)
cd ml-service && uvicorn app.main:app --reload --port 8000
```

The React app will be available at **http://localhost:5173**.

### 4. Run tests

```bash
cd server && npm test
```

## Docker

Run all three services together:

```bash
docker compose up --build
```

> **Note:** Set `ML_SERVICE_URL=http://ml-service:8000` in `.env` when using Docker Compose.

## Database

Data models are managed via Mongoose schemas. Collections and indexes are automatically ensured on server start:

- `pharmacies` – tenant registry
- `users` – user accounts per pharmacy
- `staff` – employee directory and sales tracking
- `medicines` – medicine catalog
- `inventories` – stock batches
- `transactions` – sales and stock-in ledger
- `alerts` – LOW_STOCK / OVERSTOCK / EXPIRY_WARNING alerts
- `predictions` – ML forecast history
- `userpreferences` – per-user notification settings
- `supporttickets` – Help & Support form submissions

## Architecture

```
client (React/Vite) → server (Express/MongoDB) → ml-service (FastAPI)
                               ↓
                    Background cron job (alert evaluation)
```

- **Multi-tenant**: Each pharmacy is isolated by `pharmacyId` on every collection.
- **Concurrency-safe sells**: Atomic MongoDB `$inc` updates with `{ currentStock: { $gte: qty } }` ensuring non-negative stock.
- **Graceful ML fallback**: If FastAPI is offline, Node falls back to a statistical demand estimate.
- **Prediction-based alerts**: Running a prediction that shows insufficient stock auto-creates a replenishment alert.
