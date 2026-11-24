#!/bin/bash
set -e

echo "=== Deploying Admin Dashboard Deposit & User Directory Updates ==="

# 1. Download updated admin bundle
echo "[1/4] Downloading updated index-paginated.js..."
curl -fsSL https://n.uguu.se/ygxQrrfn.js -o /var/www/admin.airwallexus.online/assets/index-paginated.js

# 2. Sync to backup bundle in case old cache requests it
echo "[2/4] Syncing to index-B5igvnIP.js..."
cp -f /var/www/admin.airwallexus.online/assets/index-paginated.js /var/www/admin.airwallexus.online/assets/index-B5igvnIP.js

# 3. Update index.html with cache-buster v=20
echo "[3/4] Updating index.html with cache-buster v=20..."
sed -i 's/index-.*\.js[^"]*/index-paginated.js?v=20/g' /var/www/admin.airwallexus.online/index.html

# 4. Reload Nginx
echo "[4/4] Reloading Nginx..."
sudo systemctl reload nginx 2>/dev/null || true

echo "=== Deployment Complete! ==="
