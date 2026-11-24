# 🚀 Sky Work: Complete aaPanel & Server Deployment Master Guide

This comprehensive, step-by-step master guide walks you through deploying the complete **Sky Work** ecosystem on your server using **aaPanel** (Linux / Ubuntu / Debian / CentOS).

---

## 📋 Architectural Overview on aaPanel

```text
                                 [ aaPanel Server (Nginx) ]
                                             │
             ┌───────────────────────────────┼───────────────────────────────┐
             │                               │                               │
             ▼                               ▼                               ▼
    User Web Landing & APK          Admin Management Panel             Backend API Service
    Domain: yourdomain.com          Domain: admin.yourdomain.com       Port: 127.0.0.1:5000
    Doc Root: /.../skywork/web      Doc Root: /.../skywork/admin       Manager: Node.js Project Manager (PM2)
    Reverse Proxy: /api, /uploads   Reverse Proxy: /api, /uploads      Database: Firebase Cloud + JSON Cache
```

---

## 🛠️ Step 1: aaPanel Prerequisites Installation

Log in to your aaPanel dashboard (`http://your-server-ip:8888`) and ensure the following modules are installed from the **App Store**:

1. **Nginx** (v1.22+ or latest stable)
2. **Node.js Project Manager** (or PM2 Manager)
   - Open **Node.js Project Manager** -> **Node version** -> Install **v20.x** (or v18.x).
3. **Git** (Usually pre-installed on Linux; if not: `apt install git -y` or `yum install git -y`).

---

## 📥 Step 2: Clone Repository to Server

Open aaPanel **Terminal** (or SSH into your VPS) and run:

```bash
cd /www/wwwroot
git clone https://github.com/twizitechsolution/skywork.git
cd skywork
```

Fix folder ownership permissions for www user:
```bash
chown -R www:www /www/wwwroot/skywork
chmod -R 755 /www/wwwroot/skywork
```

---

## 🗄️ Step 2.5: Setup Dedicated MySQL Database in aaPanel

All user accounts, balances, orders, transactions, products, withdrawals, and admin data are stored directly in your dedicated **MySQL** database (Firebase is used **only** for push notifications).

1. In aaPanel, go to **Databases** > **Add DB**.
2. Fill in:
   - **Database name**: `skywork`
   - **Username**: `skywork`
   - **Password**: Copy the generated password (or set your own).
   - **Access permission**: `Local server (127.0.0.1)`
3. Click **Submit**.
4. Update `/www/wwwroot/skywork/backend/.env` with your MySQL credentials:
   ```env
   MYSQL_HOST=127.0.0.1
   MYSQL_PORT=3306
   MYSQL_USER=skywork
   MYSQL_PASSWORD=YOUR_MYSQL_PASSWORD
   MYSQL_DATABASE=skywork
   ```
   *(When the backend starts, it will automatically create all 14 MySQL tables and seed the starter admin, super admin, and 51 product plans! You can also manage/view everything in phpMyAdmin).*

---

## ⚙️ Step 3: Setup & Launch Backend API (Port 5000)

### Method A: Via aaPanel Node.js Project Manager (Recommended GUI)

1. Go to **Website** > **Node project** > Click **Add Node Project**.
2. Fill in the configuration details:
   - **Project name**: `skywork-backend`
   - **Run opt**: `npm run start` (or `node src/server.js`)
   - **Project path**: Select `/www/wwwroot/skywork/backend`
   - **Run User**: `www`
   - **Node version**: Select **v20.x** (or installed v18+)
   - **Project port**: `5000`
3. Click **Submit**. aaPanel will automatically install dependencies and start the backend service under PM2.

### Method B: Via Terminal / PM2 (CLI)

```bash
cd /www/wwwroot/skywork/backend
npm install --production

# Start with PM2
pm2 start ecosystem.config.json

# Save PM2 state to survive reboots
pm2 save
pm2 startup
```

### Verify Backend Health:
Run in terminal:
```bash
curl http://127.0.0.1:5000/api/health
```
Expected output:
```json
{"success":true,"status":"online","service":"Sky Work Backend API","version":"1.0.0"}
```

---

## 🌐 Step 4: Setup User Web App & Mobile Web Site

1. In aaPanel, go to **Website** > **Add site**.
2. **Domain name**: Enter your user domain (e.g., `skywork.us.cc` or `yourdomain.com`).
3. **Root directory**: Set to `/www/wwwroot/skywork/web`
4. **FTP / Database**: Leave as *Do not create*.
5. Click **Submit**.

### Configure Reverse Proxy for API & Uploads:
1. Click on the newly created website > go to **Reverse proxy** > **Add reverse proxy**.
2. **Proxy Name**: `backend-api`
3. **Target URL**: `http://127.0.0.1:5000`
4. **Sent Domain**: `$host`
5. Click **Submit**.

### Configure URL Rewrite for Single Page Application (SPA):
1. In the website settings, go to **URL rewrite**.
2. Paste the following Nginx rule and click **Save**:
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

### Apply SSL (HTTPS):
1. In website settings > **SSL** > **Let's Encrypt**.
2. Select your domain, click **Apply**.
3. Toggle on **Force HTTPS**.

---

## 👑 Step 5: Setup Admin Management Dashboard Site

1. In aaPanel, go to **Website** > **Add site**.
2. **Domain name**: Enter your admin subdomain (e.g., `admin.skywork.us.cc` or `admin.yourdomain.com`).
3. **Root directory**: Set to `/www/wwwroot/skywork/admin`
4. Click **Submit**.

### Configure Reverse Proxy for Admin API:
1. Click on the admin website > go to **Reverse proxy** > **Add reverse proxy**.
2. **Proxy Name**: `admin-api`
3. **Target URL**: `http://127.0.0.1:5000`
4. **Sent Domain**: `$host`
5. Click **Submit**.

### Configure URL Rewrite for Admin SPA:
1. In admin website settings, go to **URL rewrite**.
2. Paste the following and click **Save**:
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

### Apply SSL (HTTPS):
1. Go to **SSL** > **Let's Encrypt** > Apply SSL & enable **Force HTTPS**.

---

## 📱 Step 6: Native Android APK Verification & Distribution

- The production signed APK is automatically available at:
  `https://yourdomain.com/SkyWork.apk`
- The User Web App homepage automatically features the direct **Download Android Application** button linking to `/SkyWork.apk`.
- If you need to re-point or rebuild the APK to your own domain at any time:
  ```bash
  python rebrand_apk.py "Sky Work" "yourdomain.com" "web/SkyWork.apk" "com.skywork.app"
  ```

---

## 🔑 Default Credentials & Access Checklist

| Component | Endpoint | Default Login Credentials |
| :--- | :--- | :--- |
| **Admin Management Panel** | `https://admin.yourdomain.com` | Username: `admin`<br>Password: `123456` |
| **Initial Super Admin User** | `https://yourdomain.com/invapp.html` | Mobile: `9999999999`<br>PIN: `1234`<br>Ref Code: `sky001` |
| **Android APK Download** | `https://yourdomain.com/SkyWork.apk` | Direct download & install |
| **Backend API Health Check** | `http://127.0.0.1:5000/api/health` | Status: `online` |

---

## 🔄 Updating Project in Future

Whenever you push changes to GitHub, update your server in 2 commands:
```bash
cd /www/wwwroot/skywork
git pull origin main
cd backend && npm install --production && pm2 restart skywork-backend
```
