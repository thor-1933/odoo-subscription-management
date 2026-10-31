# SubFlow
### Subscription & Recurring Revenue Management

**Brightloop Software · Odoo × Make-A-Ton 9.0 Hackathon (2026)**

SubFlow is a full-stack subscription billing application that brings product catalogues, quotations, recurring subscriptions, invoices, payments, and revenue analytics into one workspace. It has role-specific experiences for administrators, staff, and customers.

> **Project status:** The application is implemented locally and undergoing final security, scalability, and deployment verification. The two-second response-time target with thousands of subscriptions has **not yet been independently demonstrated**.

## What SubFlow does

| Area | Capabilities |
| --- | --- |
| Product catalogue | Products, configurable variants, pricing adjustments |
| Subscription plans | Daily, weekly, monthly, and yearly billing frequencies; lifecycle policies |
| Quotations | Line items, taxes, discounts, and conversion into subscriptions |
| Subscriptions | Lifecycle management, next billing dates, customer and plan association |
| Recurring billing | Scheduled and manual invoice generation, billing-period tracking |
| Invoices | Status tracking, outstanding balances, downloadable PDF invoices |
| Payments | Record UPI, bank transfer, card, cash, and other payments; reconcile partial/full payments |
| Analytics | MRR, ARR, collected revenue, receivables, and revenue indicators |
| Customer portal | View personal subscriptions, invoices, payments, available plans, and profile |
| Administration | Customers, staff users, taxes, discounts, and billing controls |

### Roles

- **Admin:** Financial oversight, users, configuration, and billing controls.
- **Staff:** Operational work across products, customers, quotations, subscriptions, invoices, and payments.
- **Customer:** Self-service access scoped to the customer's own records.

Role permissions are enforced through protected frontend routes and backend authentication middleware. Security hardening is in progress; do not treat the current implementation as production-hardened.

## Architecture

```text
React + Vite + TypeScript
          |
          | REST API / HTTP-only auth cookie
          v
Express + TypeScript
   |       |        |
 Billing  PDFs   Analytics
   \       |       /
        Prisma ORM
          |
 SQLite (local) / PostgreSQL (deployment)
```

**Frontend:** React 18, TypeScript, Vite, Tailwind CSS, React Router, Axios, React Hook Form, Zod, Recharts, Lucide.

**Backend:** Node.js, Express, TypeScript, Prisma, Zod, bcryptjs, JWT, node-cron, PDFKit, Nodemailer, Decimal.js.

**Deployment configuration:** Vercel (client), Render (API), Neon PostgreSQL (database). Deployment is not verified by this README.

## Project structure

```text
subflow/
├── client/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── public/       # Landing, login, registration, recovery
│   │   │   ├── admin/        # Admin and staff workspaces
│   │   │   └── customer/     # Customer portal
│   │   ├── components/       # Shared app shell and protected routes
│   │   ├── context/          # Authentication and notifications
│   │   └── api/              # HTTP client
│   └── package.json
├── server/
│   ├── src/
│   │   ├── routes/           # REST endpoints
│   │   ├── services/         # Recurring billing
│   │   ├── middleware/       # Authentication and errors
│   │   ├── tests/            # Integration test source
│   │   └── benchmark.ts      # Data-writing benchmark (see caution)
│   ├── prisma/               # SQLite/PostgreSQL schemas and demo seed
│   └── package.json
├── docs/billing-engine.md
├── .env.example
└── package.json
```

## Getting started (local development)

**Prerequisites:** Node.js 18+ and npm 9+.

Clone the repository once the application source has been uploaded, then from the `subflow` project directory:

```bash
npm install
npm --prefix server install
npm --prefix client install
```

Create `server/.env` from `server/.env.example`. For local SQLite development, configure:

```dotenv
NODE_ENV=development
PORT=5000
DATABASE_URL="file:./dev.db"
JWT_SECRET="<generate-a-long-random-secret>"
CLIENT_URL="http://localhost:5173"
ENABLE_BACKGROUND_SCHEDULER="false"
```

Use a genuinely random JWT secret; **never reuse the sample secret from earlier development configurations**. Do not commit `.env`, database files, or credentials.

Initialize a **new, disposable** local SQLite database:

```bash
npm --prefix server run db:generate
npm --prefix server run db:push
```

The demo seed command is `npm --prefix server run db:seed`, but **it deletes existing records before recreating sample data**. Run it only against a verified disposable database. Never use it on a populated or production database.

Start the API and frontend in separate terminals:

```bash
npm run dev:server
```

```bash
npm run dev:client
```

Open **http://localhost:5173**. The API defaults to **http://localhost:5000** with health check at `/health`.

Demo users are provisioned by the development seed. Obtain demo credentials from the project maintainer; do not publish real account passwords.

## Suggested hackathon walkthrough

1. Sign in as **Admin** and review the analytics dashboard.
2. Open **Products & Variants** and inspect base and variant pricing.
3. Compare **Subscription Plans** across billing frequencies.
4. As **Staff**, create a quotation and demonstrate quotation-to-subscription conversion.
5. Show an active subscription and its upcoming billing date.
6. As **Admin**, demonstrate **Run Billing** against disposable demo records.
7. Open **Invoices**, record a partial payment, and show the remaining balance.
8. Record the remaining payment and demonstrate the paid state.
9. Download an invoice **PDF**.
10. Sign in as **Customer** and show access to customer-specific subscriptions, invoices, and payment history.

**Caution:** Billing and payment actions write financial records. Use a disposable demonstration database.

## Verification

```bash
npm run build
```

This builds the server and client. The codebase also defines:

```bash
npm test
npm --prefix server run benchmark
```

**Do not run these blindly on important data.** The current tests and benchmark can mutate subscription, invoice, or billing records. The benchmark generates synthetic subscriptions and invokes actual billing; it is **not** a validated HTTP load test.

### Performance requirement

The hackathon problem statement expects application pages to respond within **two seconds even with thousands of subscriptions**. Representative endpoint and browser measurements at scale are pending. The current subscription listing is not server-paginated, so performance should not be claimed as verified.

## Deployment notes

The repository includes `client/vercel.json` and `server/render.yaml`. For production PostgreSQL, use the PostgreSQL Prisma schema explicitly and validate Prisma client generation and database migration against the target environment. Configure trusted origins, unique secrets, SMTP credentials, and appropriate scheduler settings before public deployment.

## Known hardening work

The current source audit identified work remaining around public registration role restrictions, credentialed CORS/CSRF, secret fallbacks, concurrent payment reconciliation, billing idempotency, pagination, and safe test isolation. Track and address these before a public production launch.

## Team and contributions

Developed by **Brightloop** for **Odoo × Make-A-Ton 9.0**. Add verified team-member names, responsibilities, and links after confirming the final submission roster.

---

**SubFlow — clarity and control across the subscription lifecycle.**
