# PIMS – Pharmaceutical Inventory Management System

Production-oriented React + Express + FastAPI microservice architecture for pharmacy inventory forecasting and management.

## Services

| Service | Stack |
|---------|-------|
| `client` | React 19 + Vite + TailwindCSS |
| `server` | Node.js + Express + MongoDB (Mongoose) + JWT auth + cron alert jobs |
| `ml-service` | FastAPI + Uvicorn + scikit-learn/statsmodels (demand forecasting with offline trained models) |

## Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.11
- **MongoDB** ≥ 6.0 (Atlas cloud instance or local instance)

---

### Quick Launch (Local Development)

Simply run from the project root:

```bash
npm start
```

This will:
- Automatically check and free required ports (`5000`, `5173`, `8000`)
- Launch the **Backend Server** (port 5000), **Frontend Client** (port 5173), and **ML Prediction Service** (port 8000) concurrently with colored prefix logs
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
- `MONGODB_URI` – MongoDB connection string (e.g., `mongodb://127.0.0.1:27017/pims` or Atlas URI)
- `JWT_ACCESS_SECRET` – 64-character hex secret (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- `JWT_REFRESH_SECRET` – a different 64-character hex secret
- `ML_SERVICE_URL` – `http://localhost:8000` (or deployed FastAPI URL)
- `CLIENT_URL` – `http://localhost:5173` (or deployed Vercel frontend URL)

#### 2. Install dependencies

```bash
# React client
cd client && npm install

# Express server
cd ../server && npm install

# FastAPI ML service
cd ../ml-service && pip install -r requirements.txt
```

#### 3. Start services

```bash
# Terminal 1 – Express backend
cd server && npm run dev

# Terminal 2 – React frontend
cd client && npm run dev

# Terminal 3 – FastAPI ML service
cd ml-service && uvicorn app.main:app --reload --port 8000
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
  - `MONGODB_URI`: `mongodb+srv://<user>:<password>@cluster.mongodb.net/pims?retryWrites=true&w=majority`
  - `JWT_ACCESS_SECRET`: `64_char_hex_secret`
  - `JWT_REFRESH_SECRET`: `different_64_char_hex_secret`
  - `JWT_ACCESS_EXPIRY`: `15m`
  - `JWT_REFRESH_EXPIRY`: `7d`
  - `CLIENT_URL`: `https://<your-vercel-app>.vercel.app`
  - `ML_SERVICE_URL`: `https://<your-render-ml-service>.onrender.com`

### 3. ML Service Deployment (Render - Web Service)
- **Environment**: Python 3
- **Root Directory**: `ml-service`
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

---

## Running Tests

```bash
# Run entire integration test suite
npm test

# Run OTP & Credential generation verification suite
npm run test:otp --prefix server

# ML demand forecasting suite
node server/src/tests/forecasting_integration.test.js

# Atomic inventory concurrency suite
npm run test:concurrency --prefix server
```

---

## Database Collections

Managed automatically via Mongoose:
- `pharmacies` – Multi-tenant registry
- `users` – User accounts per pharmacy workspace
- `staff` – Employee directory, roles, and sales tracking
- `otps` – Bcrypt-hashed purpose-based verification tokens with 5-minute TTL
- `medicines` – Medicine catalog and ATC category mapping
- `inventories` – Stock batches with expiry tracking
- `transactions` – Sales and stock-in ledger
- `alerts` – LOW_STOCK, OVERSTOCK, and EXPIRY_WARNING notifications
- `predictions` – ML forecast history
- `userpreferences` – Per-user notification settings
- `supporttickets` – Help & Support submissions

---

## Architecture

```
client (React 19 / Vite) → server (Express / MongoDB) → ml-service (FastAPI / Frozen Models)
                                     ↓
                          Background cron job (alert evaluation)
```

- **Multi-tenant Isolation**: Each pharmacy is strictly isolated by `pharmacyId` on all database collections.
- **Concurrency-safe Sells**: Atomic MongoDB `$inc` updates ensure non-negative stock under high concurrency.
- **Dynamic Demand Forecasting**: Pre-trained time-series models (SARIMA, Holt-Winters, Seasonal Indexing) predict seasonal normalized demand factors scaled by pharmacy baseline.
- **Prediction Replenishment Alerts**: Automated `LOW_STOCK` alerts generated when active stock falls below recommended safety levels.
