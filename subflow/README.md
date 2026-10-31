# SubFlow — Enterprise Subscription & Recurring Revenue Management

> Built for **Brightloop Software** | **Odoo × Make-A-Ton 9.0 Hackathon**

SubFlow is a centralized, commercial-grade SaaS subscription billing platform. It handles the complete lifecycle of recurring revenue contracts: product catalog and dynamic variant pricing, configurable multi-frequency plans (Daily, Weekly, Monthly, Yearly), template-based quotations, automated multi-period recurring billing, localized tax and discount computation, invoice PDF generation, partial and full payment reconciliation, and real-time database-driven SaaS financial analytics (MRR/ARR).

---

## 1. System Architecture

```
                                  ┌─────────────────────────────┐
                                  │      React + Vite + TS      │
                                  │     Tailwind CSS Dashboard  │
                                  └──────────────┬──────────────┘
                                                 │ HTTP-Only Cookies / REST API
                                                 ▼
                                  ┌─────────────────────────────┐
                                  │    Express + TypeScript     │
                                  │   RBAC Auth & Rate Limiter  │
                                  └──────────────┬──────────────┘
                                                 │
                        ┌────────────────────────┼────────────────────────┐
                        ▼                        ▼                        ▼
         ┌────────────────────────┐  ┌───────────────────────┐  ┌───────────────────┐
         │ Automated Recurring    │  │ Invoice & PDF Ledger  │  │ Real-time MRR/ARR │
         │ Billing Cron Scheduler │  │ Payment Reconciliation│  │ Analytics Engine  │
         └──────────────┬─────────┘  └───────────┬───────────┘  └─────────┬─────────┘
                        │                        │                        │
                        └────────────────────────┼────────────────────────┘
                                                 ▼
                                  ┌─────────────────────────────┐
                                  │    Prisma ORM & Decimals    │
                                  │   (PostgreSQL / SQLite)     │
                                  └─────────────────────────────┘
```

---

## 2. Technology Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, React Router v6, Axios, Lucide React, Recharts, React Hook Form, Zod.
- **Backend**: Node.js, Express.js, TypeScript, Prisma ORM, Zod, bcryptjs, HTTP-only cookie JWT auth, Nodemailer, node-cron, Decimal.js.
- **Database**: PostgreSQL (Neon for cloud deployment) / local SQLite for instant zero-dependency local development.
- **Deployment**:
  - **Frontend**: Vercel (`vercel.json` configured with SPA routing)
  - **Backend**: Render (`render.yaml` configured with health check)
  - **Database**: Neon Hosted Serverless PostgreSQL

---

## 3. Demo Workspaces

The seed script (`npm run db:seed`) provisions local demonstration data for three workspace roles. Sign in with an account configured for your environment; account identifiers and passwords are intentionally not published in this document.
The seed script deletes all existing records before it inserts sample data. Run it only against a disposable database, with `SEED_ALLOW_RESET=true`; for a non-SQLite database it additionally requires `SEED_ALLOW_REMOTE_DATABASE=true`. It refuses to run when `NODE_ENV=production`.

| Role | Primary Capabilities |
| :--- | :--- |
| **ADMIN** | Financial analytics, staff management, tax and discount configuration, billing controls. |
| **STAFF** | Quotations, subscriptions, invoices, customers, and payment recording. |
| **CUSTOMER** | Self-service subscriptions, available plans, invoices, payment history, and profile. |

---

## 4. Acceptance Criteria Demonstration Workflow

Follow these steps to demonstrate the end-to-end hackathon requirements:

1. **Admin Login**:
   - Navigate to `/login` and sign in with an Admin account configured for your environment.
2. **Product & Variant Pricing**:
   - Go to **Products & Variants** (`/products`).
   - View `Brightloop Business Software` (Base: ₹1,000).
   - View configured variant: `Odoo Powered Edition` (+₹560 adjustment) producing the exact effective price of **₹1,560**.
3. **Subscription Plans & Frequency Arithmetic**:
   - Go to **Subscription Plans** (`/plans`).
   - View Daily, Weekly, Monthly, and Yearly plans with explicit policy rules (`allowEarlyCancellation`, `allowPause`, `allowRenewal`, `autoClose`).
4. **Staff Quotation to Subscription Conversion**:
   - Sign in with a Staff account configured in your local environment.
   - Go to **Quotations** (`/quotations`).
   - Draft a quotation with product lines, tax (18% GST), and promotional coupon (`EARLYBIRD20`).
   - Click **"Convert to Sub"** on an accepted quotation — automatically converts into an active subscription with scheduled next billing dates.
5. **Automated Recurring Billing & Idempotency**:
   - Sign in with an Admin account configured in your local environment.
   - Click the **"Run Billing Now"** button in the top navigation bar.
   - The billing engine queries due subscriptions, generates invoices with accurate line items, taxes, and discounts, and advances `nextBillingDate`.
   - Click **"Run Billing Now"** a second time — the system detects the unique `[subscriptionId, periodStart, periodEnd]` constraint and avoids duplicate invoice generation.
6. **Payment Recording & Ledger Balance Reconciliation**:
   - Go to **Invoices** (`/invoices`).
   - Click **"Record Pay"** on any open invoice.
   - Enter partial payment (e.g., ₹500 via UPI). Notice the outstanding balance immediately decrements.
   - Record remaining balance — the invoice automatically transitions to **PAID**.
7. **Download Invoice PDF**:
   - Click the **"PDF"** button on any invoice to download an A4 formatted PDF invoice containing company branding, line details, and tax breakdowns.
8. **Real-time Analytics Dashboard**:
   - Go to **SaaS Analytics** (`/dashboard`).
   - View real-time computed MRR, ARR, Collected Revenue, Overdue Receivables, Revenue Growth Trend, and Payment breakdown based on actual ledger entries.
9. **Customer Portal & Data Isolation**:
   - Sign in with a Customer account configured in your local environment.
   - Customer sees only Acme's subscriptions and invoices.
   - Directly requesting `/api/customers/<other-customer-id>` returns `403 Forbidden` from backend middleware.

---

## 5. Local Setup Instructions

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0

### Step 1: Install Dependencies
```bash
# In the project root:
cd subflow
npm install

# Install server and client dependencies:
cd server && npm install
cd ../client && npm install
```
Copy `server/.env.example` to `server/.env` for local server settings, then set `JWT_SECRET` to a unique random value of at least 32 characters. Do not use the example placeholder as a secret.

### Step 2: Database Initialization & Seeding
```bash
cd server
# Generate Prisma Client & sync SQLite database:
npx prisma generate
npx prisma db push

# Populate with realistic demo data:
SEED_ALLOW_RESET=true npm run db:seed
```
In PowerShell, set the opt-in before seeding with `$env:SEED_ALLOW_RESET="true"; npm run db:seed`. The seed clears existing records, so use it only against a disposable database; it refuses production mode and remote databases unless separately authorized. Generate a secret with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. Configure `CLIENT_URL` and, for additional frontends, `CORS_ALLOWED_ORIGINS` with exact origins. Password reset email requires `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS`; without these settings, delivery is reported as unavailable.

### Step 3: Run the Development Servers
In two separate terminals:
```bash
# Terminal 1: Run Express Server (Port 5000)
cd server
npm run dev

# Terminal 2: Run React Client (Port 5173)
cd client
npm run dev
```

Visit `http://localhost:5173` in your browser.

---

## 6. Running Tests & Benchmarks

```bash
cd server

# Run the 10-point comprehensive integration test suite:
npm run test

# Run safe request-security unit tests:
npm run test:security

# Run the 1,000-subscription performance benchmark:
npm run benchmark
```
The integration tests and benchmark perform database writes; use only a disposable test database. The benchmark invokes recurring billing and is not safe to run against production or an important local database.

---

## 7. Cloud Deployment Guide

### Database (Neon PostgreSQL)
1. Create a serverless PostgreSQL database on [Neon.tech](https://neon.tech).
2. Copy the connection string (`postgresql://user:password@ep-host.us-east-2.aws.neon.tech/subflow?sslmode=require`).
3. Set `DATABASE_URL` in your server environment variables.
4. Point to the production PostgreSQL schema:
   ```bash
   cp prisma/schema.postgresql.prisma prisma/schema.prisma
   npx prisma db push
   ```

### Backend (Render)
1. Create a new Web Service on [Render](https://render.com) pointing to `subflow/server`.
2. Build Command: `npm install && npx prisma generate --schema prisma/schema.postgresql.prisma && npm run build`
3. Start Command: `npm start`
4. Health Check Path: `/health`
5. Configure Environment Variables: `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET`, `CLIENT_URL`.

### Frontend (Vercel)
1. Deploy `subflow/client` on [Vercel](https://vercel.com).
2. Framework Preset: `Vite`
3. Root Directory: `subflow/client`
4. Set Environment Variable: `VITE_API_URL=https://your-render-backend.onrender.com/api`

---

## 8. Known Limitations & Extensibility

- **Online Payment Gateways**: The current system accurately records transactions via UPI, NEFT, and Cards. Live webhook listeners for Stripe/Razorpay can be enabled via webhook handlers in `src/routes/payment.routes.ts`.
- **Email Delivery**: Password reset email is sent only when `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` are configured. Configure a real SMTP provider for deployed environments.
