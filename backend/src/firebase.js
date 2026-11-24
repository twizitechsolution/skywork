const admin = require('firebase-admin');
const { getMessaging } = require('firebase-admin/messaging');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');

let initialized = false;

// Helper to safely parse service account from env or file (Push Notifications ONLY)
function resolveServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
      return raw.startsWith('{') ? JSON.parse(raw) : JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    } catch (err) {
      console.error('[Firebase Push] Failed to parse FIREBASE_SERVICE_ACCOUNT env:', err.message);
    }
  }

  if (process.env.FIREBASE_CONFIG) {
    try {
      const raw = process.env.FIREBASE_CONFIG.trim();
      if (raw.startsWith('{')) {
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('[Firebase Push] Failed to parse FIREBASE_CONFIG env:', err.message);
    }
  }

  if (fs.existsSync(serviceAccountPath)) {
    try {
      return require(serviceAccountPath);
    } catch (err) {
      console.error('[Firebase Push] Failed to read firebase-service-account.json file:', err.message);
    }
  }

  return null;
}

const serviceAccount = resolveServiceAccount();

if (serviceAccount) {
  try {
    const apps = typeof admin.getApps === 'function' ? admin.getApps() : (admin.apps || []);
    if (!apps.length) {
      admin.initializeApp({
        credential: admin.credential ? admin.credential.cert(serviceAccount) : admin.cert(serviceAccount)
      });
    }
    initialized = true;
    console.log('[Firebase Push] FCM Push Notification service initialized (Database handled by MySQL).');
  } catch (err) {
    console.error('[Firebase Push] Failed to initialize FCM:', err.message);
  }
} else {
  console.warn('[Firebase Push] No Firebase credentials found. Push notifications will run in mock mode.');
}

/**
 * Push Notification Dispatcher (FCM Only)
 */
async function sendPushNotification(user, title, body, data = {}) {
  if (!user) return;
  if (!initialized) {
    console.log(`[Firebase Push Mock] Push to User ${user.username} (ID: ${user.id}): "${title}" - "${body}"`);
    return;
  }

  if (!user.fcm_tokens || user.fcm_tokens.length === 0) {
    return;
  }

  const tokens = user.fcm_tokens.filter(t => t && t.trim().length > 0);
  if (tokens.length === 0) return;

  const message = {
    notification: { title, body },
    data,
    tokens
  };

  try {
    const response = await getMessaging().sendEachForMulticast(message);
    console.log(`[Firebase Push] Multicast sent: ${response.successCount} success, ${response.failureCount} failed.`);
  } catch (err) {
    console.error('[Firebase Push] Error sending multicast message:', err.message);
  }
}

module.exports = {
  admin,
  isPushInitialized: () => initialized,
  sendPushNotification
};
