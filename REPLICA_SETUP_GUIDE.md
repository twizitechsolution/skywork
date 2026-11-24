# 🚀 Sky Work: Complete Replica Setup & Deployment Master Guide

This document provides the complete, production-ready guide for launching the newly replicated platform **Sky Work** under the domain **`skywork.us.cc`**, with clean isolated databases, admin panel, user web app, and the native Android APK.

---

## 🌟 Executive Summary of Setup

| Component | Setting / Configuration | Details |
|-----------|-------------------------|---------|
| **Brand Name** | **Sky Work** | Rebranded across all UI, endpoints, headers, and app manifests |
| **User Web Domain** | `https://skywork.us.cc` | Customer landing, dashboard, task system & registration |
| **Admin Panel** | `https://admin.skywork.us.cc` | Admin management dashboard (or dedicated Vercel deployment) |
| **Admin Login** | `admin` / `123456` | Pre-configured in database and `.env` |
| **Super Admin Account** | Mobile `9999999999`, PIN `1234` | Initial system user ID 1 |
| **Database** | `database.json` (Distinct & Clean) | 0 old users/orders, fresh counters, pre-seeded 51 product plans |
| **Safety Backup** | `database_ar_olx_airwallex_backup.json` | Complete original database with 1,587 users & 4,483 transactions |
| **Android APK** | `SkyWork.apk` (32.8 MB) | Signed with SHA-256 release keystore, offline assets bundled |

---

## 🏗️ Deployment Options (Vercel & VPS)

### Option 1: Vercel Full-Stack / Hybrid Deployment (Requested)

Each module now contains a custom `vercel.json` pre-configured for Vercel:

1. **Deploying the User Web App (`airwallexus.online/`) to Vercel**:
   - In Vercel Dashboard, click **Add New > Project** and import the `airwallexus.online/` folder (or push it to a GitHub repository).
   - Framework Preset: **Other** / Static Site (Root directory: `airwallexus.online`).
   - Assign your custom domain: **`skywork.us.cc`** (and `skywork.us.cc`).
   - The included `vercel.json` handles Single-Page Application (SPA) routing automatically.

2. **Deploying the Admin Panel (`admin.airwallexus.online/`) to Vercel**:
   - In Vercel, create a second project importing `admin.airwallexus.online/`.
   - Framework Preset: **Other** / Static Site.
   - Assign your custom domain: **`admin.skywork.us.cc`**.
   - The included `vercel.json` routes all routes to `index.html`.

3. **Backend API (`airwallex-backend/`)**:
   - The backend includes `api/index.js` and `vercel.json` for Vercel `@vercel/node` serverless functions.
   - ⚠️ **Important Persistence Note**: Vercel serverless functions are ephemeral (their local disk resets across invocations). For permanent production data persistence of deposits, orders, and user balances, we recommend either:
     - **Co-hosting the backend on a lightweight Linux VPS / Cloud VM** (e.g. Hostinger, DigitalOcean $4/mo, Render, or Railway) using `pm2 start ecosystem.config.json`.
     - Connecting the Express backend to a cloud document store (like MongoDB Atlas or Firebase Firestore).

---

## 🗄️ Database Structure & Initialization

The database has been cleanly decoupled and initialized at:
`airwallex-backend/data/database.json`

- **Clean State**:
  - `users`: 1 Initial Super Admin (`admin001` referral code, clean balances)
  - `orders`: Empty `[]`
  - `transactions`: Empty `[]`
  - `bank_accounts`: Empty `[]`
  - `withdrawals`: Empty `[]`
  - `disputes`: Empty `[]`
  - `products`: 51 standard investment and task packages preserved
  - `price_ranges`: 4 standard price tiers preserved
  - `settings`: Telegram group set to `https://t.me/SkyWork`, commission tiers 5%, 2.5%, 2%
  - `admin`: User `admin`, Password `123456`
  - `idTrackers`: Fresh ID sequences starting from 1

---

## ☁️ Firebase Firestore Cloud Database Synchronization

The backend now natively synchronizes with **Google Cloud Firebase Firestore**:
- **Automatic Cloud Seeding**: When Firebase credentials are provided, the backend automatically seeds all 51 product plans, clean admin account (`admin` / `123456`), and system settings directly into Firestore.
- **Bi-Directional Real-Time Sync**: Every user registration, order, withdrawal, and balance update syncs to Firestore in real-time.
- **Vercel Serverless Ready**: Perfect for Vercel deployment where the local filesystem is ephemeral.
- **Two Ways to Connect Firebase**:
  1. **Option A (Vercel Environment Variable)**: In Vercel Project Settings > Environment Variables, add `FIREBASE_SERVICE_ACCOUNT` with the entire JSON content of your service account key.
  2. **Option B (Local File)**: Place your downloaded `firebase-service-account.json` file inside `airwallex-backend/src/`.

---

## 📱 Native Android App (`SkyWork.apk`)

A production-ready native Android APK has been built and cryptographically signed:
- **Location**: `airwallexus.online/SkyWork.apk`
- **Application Name**: Sky Work
- **Package ID**: `com.skywork.app`
- **Domain Endpoint**: `https://skywork.us.cc`
- **Signature**: Signed with RSA 2048-bit SHA-256 release keystore (`release.keystore`).

To re-generate or rebuild the APK at any time with new assets or domains:
```bash
python rebrand_apk.py "Sky Work" "skywork.us.cc" "airwallexus.online/SkyWork.apk" "com.skywork.app"
```

---

## ⚙️ Running Backend Locally / On Server

1. **Install Dependencies**:
   ```bash
   cd airwallex-backend
   npm install --production
   ```

2. **Start Server**:
   ```bash
   node src/server.js
   # Or with PM2
   pm2 start ecosystem.config.json
   ```

3. **Admin Login**:
   - URL: `https://admin.skywork.us.cc` (or `http://localhost:5000/admin`)
   - Username: `admin`
   - Password: `123456`
