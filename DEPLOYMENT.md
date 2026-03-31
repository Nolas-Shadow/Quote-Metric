# QuoteMetric Deployment Guide

Complete deployment instructions for multiple platforms. Choose the option that fits your needs.

---

## 🎯 Recommended: Railway.app

**Why Railway?** Your app works with **zero code changes**, free tier available, deploys in 5 minutes.

### Step 1: Create Railway Account

1. Go to [railway.app](https://railway.app)
2. Click **"Start a New Project"**
3. Sign up with GitHub (recommended) or email

### Step 2: Connect Your GitHub Repository

1. Click **"New Project"** → **"Deploy from GitHub repo"**
2. Select your `quotemetric-system` repository
3. Railway will auto-detect it's a Node.js app

### Step 3: Configure Environment Variables

In Railway dashboard, go to **Variables** tab and add:

```env
PORT=3000
NODE_ENV=production
DATABASE_PATH=./database/quotemetric.db
JWT_SECRET=generate-a-random-secure-string-here
SESSION_SECRET=generate-another-random-string-here
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760
AI_UPSELL_ENABLED=true
COMPANY_NAME=Your Company Name
COMPANY_PHONE=(555) 123-4567
COMPANY_EMAIL=support@yourcompany.com
```

### Step 4: Deploy

1. Railway automatically deploys when you push to GitHub
2. First deploy takes ~2-3 minutes
3. Database initializes automatically (from `postinstall` script)

### Step 5: Access Your App

1. Click **"Generate Domain"** in Railway dashboard
2. Your app is live at `https://your-app.railway.app`
3. Login with default admin credentials

### ⚠️ Important Notes for Railway

- **Database persists** but backup regularly
- **Free tier:** $5/month credit (enough for demo)
- **Uploads folder** is temporary (files deleted on redeploy)
- For production: Add persistent storage for uploads

---

## 🥈 Alternative: Render.com

**Why Render?** Free tier, similar to Railway, good for demos.

### Step 1: Create Render Account

1. Go to [render.com](https://render.com)
2. Sign up with GitHub

### Step 2: Create Web Service

1. Click **"New"** → **"Web Service"**
2. Connect your GitHub repository
3. Configure:
   - **Name:** quotemetric-system
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node backend/server.js`

### Step 3: Add Environment Variables

In Render dashboard, add these environment variables:

```env
PORT=3000
NODE_ENV=production
DATABASE_PATH=./database/quotemetric.db
JWT_SECRET=your-secret-key-here
SESSION_SECRET=your-session-secret-here
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760
AI_UPSELL_ENABLED=true
```

### Step 4: Deploy

1. Click **"Create Web Service"**
2. Deploy takes ~3-5 minutes
3. App is live at `https://quotemetric-system.onrender.com`

### ⚠️ Render Free Tier Limitations

- **Spins down** after 15 min of inactivity
- **First load** takes 30-50 seconds after spin-down
- Database resets on redeploy (use PostgreSQL add-on for persistence)

---

## ☁️ Cloudflare Workers (Advanced)

**Note:** Your current app **cannot deploy directly** to Cloudflare Workers. Workers requires:
- No Express (use Hono or Workers native routing)
- No SQLite (use D1 or KV storage)
- No multer (use Workers file handling)

### Option A: Full Migration (Requires Rewrite)

You would need to rewrite the app using:
- **Hono** framework (Express-like for Workers)
- **Cloudflare D1** (SQLite-compatible database)
- **Cloudflare R2** (file storage for uploads)
- **Cloudflare Pages** for frontend hosting

This is a **significant rewrite** - estimate 20-40 hours.

### Option B: Cloudflare Tunnel (Recommended for Cloudflare)

Keep your app as-is, use Cloudflare Tunnel to expose it:

1. **Run your app** on Railway/Render/VPS
2. **Add Cloudflare Tunnel** for custom domain + SSL
3. **Use Cloudflare DNS** for your domain

#### Setup Cloudflare Tunnel:

```bash
# Install cloudflared
npm install -g cloudflared

# Authenticate
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create quotemetric-tunnel

# Configure tunnel (creates config file)
cloudflared tunnel route dns quotemetric-tunnel your-domain.com
```

---

## 🖥️ VPS Deployment (DigitalOcean, Linode, etc.)

For full control and lower long-term costs.

### Prerequisites
- Ubuntu 22.04 VPS ($5-10/month)
- Domain name (optional)
- SSH access

### Step 1: Connect to Server

```bash
ssh root@your-server-ip
```

### Step 2: Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs npm
```

### Step 3: Clone Repository

```bash
cd /var/www
git clone https://github.com/Nolas-Shadow/quotemetric-system.git
cd quotemetric-system
npm install
npm run init-db
```

### Step 4: Configure Environment

```bash
cp .env.example .env
nano .env
# Edit with your values
```

### Step 5: Setup PM2 (Process Manager)

```bash
npm install -g pm2
pm2 start backend/server.js --name quotemetric
pm2 save
pm2 startup
```

### Step 6: Setup Nginx (Optional - for custom domain)

```bash
apt-get install -y nginx
nano /etc/nginx/sites-available/quotemetric
```

Add this config:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/quotemetric /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### Step 7: Setup SSL (Free with Let's Encrypt)

```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
```

---

## 📊 Deployment Comparison

| Platform | Setup Time | Cost | Persistence | Best For |
|----------|-----------|------|-------------|----------|
| **Railway** | 5 min | $5/mo | Good | Quick demos |
| **Render** | 10 min | Free* | Limited* | Testing |
| **Cloudflare Tunnel** | 15 min | Free | Depends on host | Custom domains |
| **VPS** | 30 min | $5-10/mo | Full | Production |

\*Render free tier spins down and resets database

---

## 🔐 Security Checklist for Production

Before going live:

- [ ] Change default admin password
- [ ] Generate secure `JWT_SECRET` (32+ random characters)
- [ ] Generate secure `SESSION_SECRET`
- [ ] Enable HTTPS (automatic on Railway/Render)
- [ ] Set `NODE_ENV=production`
- [ ] Restrict database access
- [ ] Setup regular backups
- [ ] Configure firewall rules
- [ ] Review file upload limits

---

## 🔄 CI/CD Setup (Automatic Deploy)

### GitHub Actions for Railway

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Railway

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Railway
        uses: railroadapp/railway-deploy@v1
        with:
          token: ${{ secrets.RAILWAY_TOKEN }}
          projectId: ${{ secrets.RAILWAY_PROJECT_ID }}
```

---

## 📞 Troubleshooting

### App won't start on Railway/Render

1. Check **deployment logs** in dashboard
2. Verify `package.json` scripts are correct
3. Ensure all dependencies are in `package.json`
4. Check environment variables are set

### Database errors

```bash
# Delete and reinitialize
rm database/quotemetric.db
npm run init-db
```

### Uploads not working

1. Ensure `uploads/` folder exists
2. Check `UPLOAD_PATH` in `.env`
3. Verify write permissions

### Port conflicts

- Railway/Render set `PORT` automatically
- Never hardcode port - use `process.env.PORT`

---

## 🎯 Next Steps

1. **Choose deployment platform** (Railway recommended)
2. **Create account** on chosen platform
3. **Push code to GitHub** (see below)
4. **Deploy** following platform-specific steps
5. **Test** the live app
6. **Share demo link** with your boss

---

## 📚 Additional Resources

- [Railway Docs](https://docs.railway.app)
- [Render Docs](https://render.com/docs)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers)
- [PM2 Docs](https://pm2.keymetrics.io/docs)

---

**Need help?** Check the main README.md for app usage, or contact support.
