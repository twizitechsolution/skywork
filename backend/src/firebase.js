const admin = require('firebase-admin');
const { getMessaging } = require('firebase-admin/messaging');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');

let initialized = false;
let firestoreDb = null;

// Helper to safely parse service account from env or file
function resolveServiceAccount() {
  // 1. Environment variable: FIREBASE_SERVICE_ACCOUNT
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
      return raw.startsWith('{') ? JSON.parse(raw) : JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    } catch (err) {
      console.error('[Firebase] Failed to parse FIREBASE_SERVICE_ACCOUNT env:', err.message);
    }
  }

  // 2. Environment variable: FIREBASE_CONFIG
  if (process.env.FIREBASE_CONFIG) {
    try {
      const raw = process.env.FIREBASE_CONFIG.trim();
      if (raw.startsWith('{')) {
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('[Firebase] Failed to parse FIREBASE_CONFIG env:', err.message);
    }
  }

  // 3. Local JSON file on disk
  if (fs.existsSync(serviceAccountPath)) {
    try {
      return require(serviceAccountPath);
    } catch (err) {
      console.error('[Firebase] Failed to read firebase-service-account.json file:', err.message);
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
        credential: admin.cert(serviceAccount)
      });
    }
    initialized = true;
    firestoreDb = getFirestore();
    firestoreDb.settings({ ignoreUndefinedProperties: true });
    console.log('[Firebase] Admin SDK & Firestore database connected successfully.');
  } catch (err) {
    console.error('[Firebase] Failed to initialize Firebase:', err.message);
  }
} else {
  console.warn('[Firebase] No Firebase credentials found. Running in local file database mode.');
}

/**
 * Push Notification Dispatcher
 */
async function sendPushNotification(user, title, body, data = {}) {
  if (!user) return;
  if (!initialized) {
    console.log(`[Firebase Mock] Push to User ${user.username} (ID: ${user.id}): "${title}" - "${body}"`);
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
    console.log(`[Firebase] Multicast sent: ${response.successCount} success, ${response.failureCount} failed.`);
  } catch (err) {
    console.error('[Firebase] Error sending multicast message:', err.message);
  }
}

/**
 * Firestore Cloud Database Synchronizer
 * Collections:
 *  - skywork_meta/state (settings, admin, products, price_ranges, sliders, idTrackers)
 *  - skywork_users
 *  - skywork_orders
 *  - skywork_bank_accounts
 *  - skywork_transactions
 *  - skywork_withdrawals
 *  - skywork_disputes
 *  - skywork_user_tasks
 *  - skywork_messages
 */

async function loadFromFirestore() {
  if (!firestoreDb) return null;

  try {
    console.log('[Firebase Sync] Pulling latest database state from Firestore Cloud...');
    
    // 1. Meta & System Config
    const metaDoc = await firestoreDb.collection('skywork_meta').doc('state').get();
    if (!metaDoc.exists) {
      console.log('[Firebase Sync] Firestore database is empty. Ready for initial seeding.');
      return null;
    }

    const metaData = metaDoc.data() || {};

    const tableNames = [
      { key: 'users', coll: 'skywork_users' },
      { key: 'orders', coll: 'skywork_orders' },
      { key: 'bank_accounts', coll: 'skywork_bank_accounts' },
      { key: 'transactions', coll: 'skywork_transactions' },
      { key: 'withdrawals', coll: 'skywork_withdrawals' },
      { key: 'disputes', coll: 'skywork_disputes' },
      { key: 'user_tasks', coll: 'skywork_user_tasks' },
      { key: 'messages', coll: 'skywork_messages' }
    ];

    const dbData = {
      users: [],
      orders: [],
      bank_accounts: [],
      transactions: [],
      user_tasks: [],
      messages: [],
      withdrawals: [],
      disputes: [],
      settings: metaData.settings || {},
      products: metaData.products || [],
      price_ranges: metaData.price_ranges || [],
      sliders: metaData.sliders || [],
      admin: metaData.admin || { username: 'admin', password: '123456' }
    };

    // Parallel fetch collections
    await Promise.all(tableNames.map(async ({ key, coll }) => {
      const snapshot = await firestoreDb.collection(coll).get();
      dbData[key] = snapshot.docs.map(doc => doc.data());
    }));

    const idTrackers = metaData.idTrackers || {};

    console.log(`[Firebase Sync] Cloud state loaded: ${dbData.users.length} users, ${dbData.orders.length} orders, ${dbData.products.length} products.`);
    return { dbData, idTrackers };
  } catch (err) {
    console.error('[Firebase Sync] Error loading from Firestore:', err.message);
    return null;
  }
}

// Background sync lock & queue
let isSyncing = false;
let pendingSync = false;

async function syncToFirestore(dbData, idTrackers) {
  if (!firestoreDb) return;
  if (isSyncing) {
    pendingSync = true;
    return;
  }

  isSyncing = true;
  try {
    // 1. Sync Meta document
    await firestoreDb.collection('skywork_meta').doc('state').set({
      settings: dbData.settings || {},
      admin: dbData.admin || { username: 'admin', password: '123456' },
      products: dbData.products || [],
      price_ranges: dbData.price_ranges || [],
      sliders: dbData.sliders || [],
      idTrackers: idTrackers || {},
      updated_at: new Date().toISOString()
    }, { merge: true });

    // 2. Batch sync collections
    const collectionsToSync = [
      { key: 'users', coll: 'skywork_users', idField: 'id' },
      { key: 'orders', coll: 'skywork_orders', idField: 'id' },
      { key: 'bank_accounts', coll: 'skywork_bank_accounts', idField: 'id' },
      { key: 'transactions', coll: 'skywork_transactions', idField: 'id' },
      { key: 'withdrawals', coll: 'skywork_withdrawals', idField: 'id' },
      { key: 'disputes', coll: 'skywork_disputes', idField: 'id' },
      { key: 'user_tasks', coll: 'skywork_user_tasks', idField: 'id' },
      { key: 'messages', coll: 'skywork_messages', idField: 'id' }
    ];

    for (const { key, coll, idField } of collectionsToSync) {
      const items = dbData[key] || [];
      if (items.length === 0) continue;

      // Process in chunks of 450 (Firestore limit is 500 per batch)
      const chunkSize = 450;
      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        const batch = firestoreDb.batch();
        for (const item of chunk) {
          const docId = String(item[idField] || item.order_id || `${key}_${Date.now()}`);
          const ref = firestoreDb.collection(coll).doc(docId);
          batch.set(ref, item, { merge: true });
        }
        await batch.commit();
      }
    }
  } catch (err) {
    console.error('[Firebase Sync] Error syncing state to Firestore:', err.message);
  } finally {
    isSyncing = false;
    if (pendingSync) {
      pendingSync = false;
      syncToFirestore(dbData, idTrackers);
    }
  }
}

module.exports = {
  admin,
  firestoreDb,
  isFirebaseConnected: () => !!firestoreDb,
  sendPushNotification,
  loadFromFirestore,
  syncToFirestore
};
