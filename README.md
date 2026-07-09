# CreditBridge — Trusted MSME Credit Intelligence

CreditBridge is a premium MSME Credit Intelligence platform featuring a Next.js frontend, a Node.js/Express backend anchored to a simulated blockchain ledger, and a Python FastAPI ML scoring engine with SHAP explainability.

---

## Architecture & Port Mapping

When running locally, the application consists of three services hosted on `localhost`:

| Service | Technology | URL / Port | Directory |
| :--- | :--- | :--- | :--- |
| **Frontend** | Next.js (App Router) | `http://localhost:3000` | `./` (Root) |
| **Backend** | Express + Prisma + SQLite | `http://localhost:4000` | `./backend` |
| **ML Service** | FastAPI + Random Forest + SHAP | `http://localhost:8001` | `./backend/ml_service` |

---

## Prerequisites

Ensure you have the following installed on your local machine:
- **Node.js** (v18 or higher)
- **Python** (v3.9 or higher)
- **npm** (comes with Node.js)

---

## Hosting on `localhost` (Step-by-Step)

Follow these steps to spin up all three servers:

### Step 1: Start the ML Service
1. Navigate to the ML service directory:
   ```bash
   cd backend/ml_service
   ```
2. Create a virtual environment and activate it:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install the Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the FastAPI microservice on port `8001`:
   ```bash
   uvicorn app:app --host 0.0.0.0 --port 8001
   ```

### Step 2: Start the Express Backend
1. Open a new terminal and navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install the Node dependencies:
   ```bash
   npm install
   ```
3. Generate the Prisma database client:
   ```bash
   npx prisma generate
   ```
4. Start the development server (runs on `http://localhost:4000`):
   ```bash
   npm run dev
   ```

### Step 3: Start the Next.js Frontend
1. Open a new terminal and navigate to the project root directory:
   ```bash
   cd ..
   ```
2. Install the dependencies:
   ```bash
   npm install
   ```
3. Start the Next.js development server (runs on `http://localhost:3000`):
   ```bash
   npm run dev
   ```

---

## Verifying the Setup

Open your browser and visit:
- **Dashboard**: [http://localhost:3000](http://localhost:3000) (Log in with one of the seeded credentials in `backend/prisma/seed.js`, e.g., `owner@arjunatextile.in` / `password123`).
- **Backend API Status**: `http://localhost:4000/api/v1/...`
- **ML Health Check**: [http://localhost:8001/health](http://localhost:8001/health) (Should return `{"status":"healthy","models_loaded":true}`).
