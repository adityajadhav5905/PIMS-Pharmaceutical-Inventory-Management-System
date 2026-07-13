# Medical Inventory Prediction System

Production-oriented MERN + FastAPI microservice architecture for hospital pharmacy inventory forecasting and management.

## Services

- `client`: React + Vite + Tailwind + Redux Toolkit + React Query
- `server`: Node.js + Express + MongoDB + JWT auth + alert jobs
- `ml-service`: FastAPI prediction endpoint with placeholder model

## Quick Start

1. Copy `.env.example` to `.env` and fill secrets.
2. Install dependencies:
   - `cd client && npm install`
   - `cd ../server && npm install`
   - `cd ../ml-service && pip install -r requirements.txt`
3. Start locally:
   - Server: `cd server && npm run dev`
   - Client: `cd client && npm run dev`
   - ML service: `cd ml-service && uvicorn app.main:app --reload --port 8000`

## Database scripts

From root:

- `node database/mongo-init.js`
- `node database/seed-data.js`
- `node database/indexes.js`

## Docker

Run all services:

`docker compose up --build`
