# QuoteMetric - Business Management System

> Complete CRM and quoting system built for service businesses (power washing, cleaning services, etc.)

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## 🚀 Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Initialize database (creates admin user + sample data)
npm run init-db

# Start server
npm start
```

Open **http://localhost:3000** and login:
- **Email:** `admin@quotemetric.io`
- **Password:** `admin123`

---

## 📋 Features

### Core Business Tools
| Feature | Description |
|---------|-------------|
| **Estimates** | Create, send, and track quotes |
| **Invoicing** | Generate invoices from approved estimates |
| **QuoteMetric Cam** | Photo documentation for jobs |
| **Scheduling** | Crew assignment calendar |
| **Inspection Forms** | Digital job forms |

### Business Control Center
| Feature | Description |
|---------|-------------|
| **Analytics Dashboard** | Business metrics and KPIs |
| **EmployeeHub** | User/role management |
| **ClientHub** | Customer database |
| **Message Log** | Email & text automation tracking |

### 🤖 AI Upsell Engine
Analyzes job site photos to suggest additional services:

| Detected Object | Suggested Service | Avg Price |
|----------------|-------------------|-----------|
| Deck | Deck Cleaning/Sealing | $400-450 |
| Windows | Window Cleaning | $200 |
| Gutters | Gutter Cleaning | $150 |
| Roof | Roof Washing | $450 |
| Driveway | Driveway Cleaning | $275 |
| Pool | Pool Deck Cleaning | $350 |

---

## 🏗️ Project Structure

```
quotemetric-system/
├── backend/
│   ├── server.js           # Express API server
│   └── init-database.js    # Database initialization
├── frontend/
│   ├── dashboard.html      # Main UI
│   ├── app.js              # Frontend logic
│   └── assets/             # Images, icons, styles
├── database/
│   └── quotemetric.db      # SQLite database (auto-created)
├── uploads/                 # Photo uploads storage
├── .env                     # Environment config
├── .gitignore               # Git ignore rules
├── package.json             # Dependencies
└── README.md                # This file
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Node.js + Express |
| **Database** | SQLite3 |
| **Auth** | JWT + bcryptjs |
| **File Upload** | Multer |
| **Frontend** | Vanilla JS + HTML5 |
| **Styling** | Custom CSS (dark theme) |

---

## 📦 API Endpoints

### Authentication
```
POST /api/auth/login      - User login
POST /api/auth/register   - Create new user (owner only)
```

### Customers
```
GET    /api/customers     - List all customers
GET    /api/customers/:id - Get customer details
POST   /api/customers     - Create customer
PUT    /api/customers/:id - Update customer
DELETE /api/customers/:id - Delete customer
```

### Estimates
```
GET    /api/estimates         - List all estimates
GET    /api/estimates/:id     - Get estimate with items
POST   /api/estimates         - Create estimate
PUT    /api/estimates/:id/status - Update status
DELETE /api/estimates/:id     - Delete estimate
```

### Photos & AI
```
POST   /api/photos            - Upload photo (triggers AI)
GET    /api/photos            - List photos
GET    /api/photos/:id/upsell - Get AI upsell suggestions
```

### Analytics
```
GET /api/analytics/dashboard  - Dashboard metrics
```

---

## 👥 User Roles

| Role | Permissions |
|------|-------------|
| **owner** | Full access, can create users |
| **manager** | Manage estimates, customers, jobs |
| **crew_member** | Upload photos, view schedule |

---

## 🔧 Configuration

Edit `.env` for your environment:

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_PATH=./database/quotemetric.db

# Security (CHANGE THESE IN PRODUCTION!)
JWT_SECRET=your-secret-key-here
SESSION_SECRET=your-session-secret-here

# File Upload
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760

# AI Settings
AI_UPSELL_ENABLED=true

# Company Info
COMPANY_NAME=Your Company
COMPANY_PHONE=(555) 123-4567
COMPANY_EMAIL=support@yourcompany.com
```

---

## 🚀 Deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for detailed deployment guides:

- ✅ **Railway.app** (Recommended - 5 min setup)
- ✅ **Render.com** (Alternative)
- ✅ **Cloudflare Workers** (Advanced - requires code changes)
- ✅ **VPS + Cloudflare Tunnel** (Self-hosted)

---

## 🗄️ Database Schema

```sql
users              - User accounts
customers          - Customer database
services           - Price list
estimates          - Quotes
estimate_items     - Estimate line items
invoices           - Invoices
jobs               - Scheduled jobs
photos             - Photo records
ai_upsell_templates - AI rules
messages           - Communication log
analytics          - Business metrics
```

---

## 📝 Usage Workflow

### Creating a Quote
1. Add/select customer
2. Create new estimate
3. Add line items from services
4. Upload photos → AI suggests upsells
5. Send to customer
6. Track status (Pending → Approved/Declined)

### Using AI Upsell
1. Go to Photos section
2. Select customer/job
3. Upload job site photo
4. Review AI suggestions
5. Add approved services to quote

---

## 🆘 Troubleshooting

**Port already in use:**
```bash
# Windows - find process on port 3000
netstat -ano | findstr :3000
# Kill with: taskkill /PID <PID> /F
```

**Database errors:**
```bash
# Delete and recreate
rm database/quotemetric.db
npm run init-db
```

**Upload fails:**
```bash
# Ensure uploads folder exists
mkdir uploads
```

---

## 📞 Support

Built for **Pink Pro Wash** and service businesses.

**Version:** 1.0.0 | **Created:** March 2026

---

## 📄 License

MIT License - See LICENSE file for details
