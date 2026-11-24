# 🚀 Sky Work Platform

Modern, cloud-synchronized investment and daily task platform with clean decoupling across **Backend API**, **Admin Management Dashboard**, **User Web App & Simulator**, and **Native Android APK**.

---

## 📂 Project Structure

```text
skywork/
├── backend/                  # Node.js + Express API Server with Firebase Firestore Cloud Sync
│   ├── api/index.js          # Vercel Serverless Function entry point
│   ├── Dockerfile            # Container definition for Docker/Coolify/Portainer
│   ├── vercel.json           # Vercel Serverless configuration
│   ├── src/                  # Controllers, middlewares, and database logic
│   ├── data/                 # Database template (database.json) & safety backup
│   └── ecosystem.config.json # PM2 configuration for VPS/Linux hosting
├── admin/                    # React Single-Page Application (Admin Management Dashboard)
│   ├── assets/               # Bundled production assets & stylesheets
│   ├── src/                  # Source components (App.jsx, ReportsManager.jsx)
│   ├── index.html            # Main Admin entry point
│   └── vercel.json           # Vercel SPA routing
├── web/                      # Responsive User Web App, Mobile Web & Android APK
│   ├── assets/               # Production bundles
│   ├── index.html            # Official mobile-optimized web landing & APK download page
│   ├── invapp.html           # Full standalone mobile application simulator
│   ├── SkyWork.apk           # Cryptographically signed native Android APK (~38.1 MB)
│   └── vercel.json           # Vercel SPA routing
├── docker-compose.yml        # Turnkey Docker deployment
├── nginx.conf                # Production Nginx reverse proxy configuration
├── dev_server.js             # Local development server (Node.js)
├── start.bat                 # 1-Click launcher for Windows
├── rebrand_apk.py            # Android APK rebuilder & signer tool
├── AAPANEL_DEPLOYMENT_GUIDE.md # Complete aaPanel Linux deployment step-by-step master guide
└── REPLICA_SETUP_GUIDE.md    # Production launch & Vercel deployment guide
```

---

## 🚀 Deployment Options

### 1. aaPanel Linux Server (Recommended)
Follow the step-by-step instructions in **[AAPANEL_DEPLOYMENT_GUIDE.md](AAPANEL_DEPLOYMENT_GUIDE.md)**:
- Deploy Backend via **Node.js Project Manager** (PM2) on port `5000`.
- Host User Web App (`web/`) with Nginx reverse proxy for `/api/`.
- Host Admin Dashboard (`admin/`) with Nginx reverse proxy for `/api/`.
- Automated 1-Click Let's Encrypt SSL.

### 2. Docker Compose
Run the entire platform with one command:
```bash
docker compose up -d
```

### 3. Vercel (Serverless / Static)
- User Web: Deploy `web/`
- Admin: Deploy `admin/`
- Backend: Deploy `backend/`

---

## 🔑 Default Credentials

- **Admin Management Panel**: `admin` / `123456`
- **Initial Super Admin Account**: Mobile `9999999999` / PIN `1234` (Ref Code: `sky001`)
- **Official Telegram Support Group**: `https://t.me/SkyWork`
