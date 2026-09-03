# 🌊 FreshWave Laundry

A full-stack laundry service web application built with React, Node.js, Prisma, and Socket.io.
Customers can browse services, place orders, and track them in real-time. Admins get a live dashboard to manage orders, services, and customers.

---

## ✨ Features

### Customer Portal
- Browse and select laundry services (by weight or per piece)
- Place orders with pickup & delivery address and scheduled time
- Multiple payment methods (Cash, Card, Wallet)
- Real-time order status tracking (Pending → Confirmed → Picked Up → Washing → Delivered)
- View full order history
- Forgot / Reset password via email

### Admin Dashboard
- Live order feed via WebSockets
- KPI metrics: total revenue, orders, active customers
- Revenue chart (last 30 days)
- Manage services: add, edit price, toggle active/inactive, delete
- Manage customers: view details, block/unblock accounts
- Assign drivers to orders and update order status

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, React Router v7, Recharts |
| Styling | Vanilla CSS (dark mode + glassmorphism) |
| Backend | Node.js, Express 5 |
| Database | SQLite via Prisma ORM |
| Real-time | Socket.io |
| Auth | JWT (30-day tokens) + bcrypt |
| Email | Nodemailer (Gmail App Password) |

---

## 📦 Prerequisites

- Node.js v18 or newer
- npm v9 or newer
- A Gmail account (for password reset emails) — [set up an App Password](https://myaccount.google.com/apppasswords)

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/freshwave-laundry.git
cd freshwave-laundry
```

### 2. Set Up the Server

```bash
cd server
npm install

# Copy the example env file and fill in your values
cp .env.example .env
```

Edit `server/.env`:
```
PORT=5000
DATABASE_URL="file:./prisma/dev.db"
JWT_SECRET=your_strong_random_secret_here
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_16_char_app_password
FRONTEND_URL=http://localhost:5173
```

> **Tip:** Generate a strong JWT secret: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`

Run the database migration and seed:
```bash
npx prisma migrate dev --name init
node seed.js
```

Start the server:
```bash
npm run dev       # development (auto-restarts with nodemon)
# or
npm start         # production
```

The server runs on **http://localhost:5000**

### 3. Set Up the Client

```bash
cd ../client
npm install

# Copy the example env file
cp .env.example .env
```

Edit `client/.env` (defaults work for local dev):
```
VITE_API_URL=http://localhost:5000/api/v1
VITE_SOCKET_URL=http://localhost:5000
```

Start the dev server:
```bash
npm run dev
```

The app runs on **http://localhost:5173**

---

## 🔐 Default Admin Account

After running `node seed.js`, an admin account is created:

| Field | Value |
|---|---|
| Email | `admin@freshwave.com` |
| Password | `admin123` |

> **Change this password immediately in production!**

- Access the **Admin Dashboard** at `/admin`
- Access the **Customer Portal** at `/`

---

## 📁 Project Structure

```
freshwave-laundry/
├── client/                  # React + Vite frontend
│   ├── src/
│   │   ├── contexts/        # Auth, Socket, Theme contexts
│   │   ├── components/      # Reusable UI (Toast, Skeleton, etc.)
│   │   ├── pages/           # CustomerPortal, AdminDashboard, Login, etc.
│   │   └── hooks/           # useSocket, useToast
│   └── .env.example
│
└── server/                  # Node.js + Express backend
    ├── src/
    │   ├── controllers/     # authController, orderController, etc.
    │   ├── middleware/      # JWT auth middleware
    │   ├── routes/          # API route definitions
    │   ├── sockets/         # Socket.io manager
    │   └── utils/           # sendEmail utility
    ├── prisma/
    │   └── schema.prisma    # Database schema
    ├── seed.js              # Database seeder
    └── .env.example
```

---

## 🌐 API Overview

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/auth/register` | — | Register new customer |
| POST | `/api/v1/auth/login` | — | Login |
| GET | `/api/v1/auth/me` | JWT | Get current user |
| POST | `/api/v1/auth/forgot-password` | — | Send reset email |
| POST | `/api/v1/auth/reset-password/:token` | — | Reset password |
| GET | `/api/v1/services` | — | List all services |
| POST | `/api/v1/orders` | JWT | Place an order |
| PUT | `/api/v1/orders/:id/pay` | JWT | Pay for an order |
| GET | `/api/v1/orders` | JWT | Get customer orders |
| GET | `/api/v1/admin/orders` | JWT+Admin | Get all orders |
| PUT | `/api/v1/admin/orders/:id/status` | JWT+Admin | Update order status |
| GET | `/api/v1/admin/customers` | JWT+Admin | List all customers |

---

## 📄 License

MIT © 2026 FreshWave Laundry
