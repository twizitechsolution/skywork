const mysql = require('mysql2/promise');

let pool = null;
let mysqlConnected = false;

function getMysqlConfig() {
  return {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'skywork',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'skywork',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    decimalNumbers: true,
    charset: 'utf8mb4'
  };
}

function parseJsonField(val, fallback = null) {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch (e) {
    return fallback;
  }
}

function stripExtra(obj, knownKeys) {
  const extra = {};
  for (const k of Object.keys(obj)) {
    if (!knownKeys.includes(k) && obj[k] !== undefined) {
      extra[k] = obj[k];
    }
  }
  return Object.keys(extra).length > 0 ? JSON.stringify(extra) : null;
}

const TABLE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS \`users\` (
    \`id\` INT NOT NULL PRIMARY KEY,
    \`uid\` VARCHAR(64) NOT NULL,
    \`username\` VARCHAR(128) DEFAULT NULL,
    \`mobile\` VARCHAR(32) NOT NULL,
    \`password_hash\` VARCHAR(255) NOT NULL,
    \`pin\` VARCHAR(32) DEFAULT NULL,
    \`ref_code\` VARCHAR(64) DEFAULT NULL,
    \`parent_id\` INT DEFAULT NULL,
    \`inr_balance\` DECIMAL(16,2) DEFAULT 0.00,
    \`bcoin_balance\` DECIMAL(16,2) DEFAULT 0.00,
    \`usdt_balance\` DECIMAL(16,4) DEFAULT 0.0000,
    \`total_earnings\` DECIMAL(16,2) DEFAULT 0.00,
    \`today_profit\` DECIMAL(16,2) DEFAULT 0.00,
    \`yesterday_profit\` DECIMAL(16,2) DEFAULT 0.00,
    \`is_blocked\` TINYINT(1) DEFAULT 0,
    \`fcm_tokens\` JSON DEFAULT NULL,
    \`created_at\` VARCHAR(64) DEFAULT NULL,
    \`extra_json\` JSON DEFAULT NULL,
    INDEX \`idx_users_uid\` (\`uid\`),
    INDEX \`idx_users_mobile\` (\`mobile\`),
    INDEX \`idx_users_ref_code\` (\`ref_code\`),
    INDEX \`idx_users_parent_id\` (\`parent_id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`orders\` (
    \`id\` INT NOT NULL PRIMARY KEY,
    \`order_id\` VARCHAR(128) NOT NULL,
    \`user_id\` INT NOT NULL,
    \`receiver_id\` INT DEFAULT NULL,
    \`asset_type\` VARCHAR(32) DEFAULT 'INR',
    \`amount\` DECIMAL(16,4) DEFAULT 0.0000,
    \`expected_income\` DECIMAL(16,4) DEFAULT 0.0000,
    \`quota\` DECIMAL(16,4) DEFAULT 0.0000,
    \`status\` VARCHAR(64) DEFAULT 'Pending',
    \`utr\` VARCHAR(128) DEFAULT NULL,
    \`proof_image\` MEDIUMTEXT DEFAULT NULL,
    \`created_at\` VARCHAR(64) DEFAULT NULL,
    \`extra_json\` JSON DEFAULT NULL,
    INDEX \`idx_orders_order_id\` (\`order_id\`),
    INDEX \`idx_orders_user_id\` (\`user_id\`),
    INDEX \`idx_orders_status\` (\`status\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`bank_accounts\` (
    \`id\` INT NOT NULL PRIMARY KEY,
    \`user_id\` INT NOT NULL,
    \`bank_name\` VARCHAR(128) DEFAULT NULL,
    \`account_holder\` VARCHAR(128) DEFAULT NULL,
    \`account_number\` VARCHAR(64) DEFAULT NULL,
    \`ifsc_code\` VARCHAR(32) DEFAULT NULL,
    \`status\` VARCHAR(32) DEFAULT 'Active',
    \`created_at\` VARCHAR(64) DEFAULT NULL,
    \`extra_json\` JSON DEFAULT NULL,
    INDEX \`idx_bank_user_id\` (\`user_id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`transactions\` (
    \`id\` INT NOT NULL PRIMARY KEY,
    \`user_id\` INT NOT NULL,
    \`type\` VARCHAR(64) DEFAULT NULL,
    \`amount\` DECIMAL(16,4) DEFAULT 0.0000,
    \`balance_after\` DECIMAL(16,4) DEFAULT 0.0000,
    \`description\` TEXT DEFAULT NULL,
    \`created_at\` VARCHAR(64) DEFAULT NULL,
    \`extra_json\` JSON DEFAULT NULL,
    INDEX \`idx_txn_user_id\` (\`user_id\`),
    INDEX \`idx_txn_type\` (\`type\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`user_tasks\` (
    \`id\` INT NOT NULL PRIMARY KEY,
    \`user_id\` INT NOT NULL,
    \`task_key\` VARCHAR(64) NOT NULL,
    \`completed\` TINYINT(1) DEFAULT 0,
    \`claimed\` TINYINT(1) DEFAULT 0,
    \`created_at\` VARCHAR(64) DEFAULT NULL,
    INDEX \`idx_tasks_user_key\` (\`user_id\`, \`task_key\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`messages\` (
    \`id\` INT NOT NULL PRIMARY KEY,
    \`title\` VARCHAR(255) DEFAULT NULL,
    \`content\` TEXT DEFAULT NULL,
    \`created_at\` VARCHAR(64) DEFAULT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`withdrawals\` (
    \`id\` INT NOT NULL PRIMARY KEY,
    \`user_id\` INT NOT NULL,
    \`amount\` DECIMAL(16,2) DEFAULT 0.00,
    \`status\` VARCHAR(64) DEFAULT 'Pending',
    \`utr\` VARCHAR(128) DEFAULT NULL,
    \`created_at\` VARCHAR(64) DEFAULT NULL,
    \`extra_json\` JSON DEFAULT NULL,
    INDEX \`idx_withdrawals_user_id\` (\`user_id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`disputes\` (
    \`id\` INT NOT NULL PRIMARY KEY,
    \`order_id\` VARCHAR(128) DEFAULT NULL,
    \`user_id\` INT NOT NULL,
    \`reason\` TEXT DEFAULT NULL,
    \`status\` VARCHAR(64) DEFAULT 'Open',
    \`created_at\` VARCHAR(64) DEFAULT NULL,
    \`extra_json\` JSON DEFAULT NULL,
    INDEX \`idx_disputes_user_id\` (\`user_id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`products\` (
    \`id\` INT NOT NULL PRIMARY KEY,
    \`name\` VARCHAR(128) DEFAULT NULL,
    \`amount\` DECIMAL(16,2) DEFAULT 0.00,
    \`income\` DECIMAL(16,2) DEFAULT 0.00,
    \`quota\` DECIMAL(16,2) DEFAULT 0.00,
    \`color\` VARCHAR(32) DEFAULT 'blue',
    \`type\` VARCHAR(32) DEFAULT 'Bank',
    \`percent\` VARCHAR(32) DEFAULT NULL,
    \`created_at\` VARCHAR(64) DEFAULT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`price_ranges\` (
    \`id\` INT NOT NULL PRIMARY KEY,
    \`label\` VARCHAR(64) DEFAULT NULL,
    \`min_val\` DECIMAL(16,2) DEFAULT 0.00,
    \`max_val\` DECIMAL(16,2) DEFAULT 0.00,
    \`created_at\` VARCHAR(64) DEFAULT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`sliders\` (
    \`id\` INT NOT NULL PRIMARY KEY,
    \`image_data\` MEDIUMTEXT DEFAULT NULL,
    \`created_at\` VARCHAR(64) DEFAULT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`settings\` (
    \`id\` INT NOT NULL PRIMARY KEY DEFAULT 1,
    \`level1_commission\` DECIMAL(8,2) DEFAULT 5.00,
    \`level2_commission\` DECIMAL(8,2) DEFAULT 2.50,
    \`level3_commission\` DECIMAL(8,2) DEFAULT 2.00,
    \`telegram_link\` VARCHAR(255) DEFAULT 'https://t.me/SkyWork',
    \`proof_channel_link\` VARCHAR(255) DEFAULT 'https://t.me/skyworkxcwdrl',
    \`payment_mode\` VARCHAR(32) DEFAULT 'manual',
    \`upi_ids\` TEXT DEFAULT NULL,
    \`winpey_api_key\` VARCHAR(255) DEFAULT NULL,
    \`winpey_api_secret\` VARCHAR(255) DEFAULT NULL,
    \`orders_repaired_v2\` TINYINT(1) DEFAULT 1,
    \`history_split_repaired\` TINYINT(1) DEFAULT 1,
    \`extra_json\` JSON DEFAULT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`admins\` (
    \`id\` INT NOT NULL PRIMARY KEY DEFAULT 1,
    \`username\` VARCHAR(64) NOT NULL,
    \`password\` VARCHAR(255) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`id_trackers\` (
    \`table_name\` VARCHAR(64) NOT NULL PRIMARY KEY,
    \`last_id\` INT NOT NULL DEFAULT 0
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
];

async function initMysql() {
  const cfg = getMysqlConfig();

  // Skip if MYSQL_HOST is explicitly disabled
  if (!cfg.host) {
    console.warn('[MySQL] MYSQL_HOST not configured. Running without MySQL.');
    return false;
  }

  try {
    // Try creating database first if user has privileges (non-fatal if restricted user)
    try {
      const initConn = await mysql.createConnection({
        host: cfg.host,
        port: cfg.port,
        user: cfg.user,
        password: cfg.password,
        charset: 'utf8mb4'
      });
      await initConn.query(`CREATE DATABASE IF NOT EXISTS \`${cfg.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      await initConn.end();
    } catch (createErr) {
      // Non-fatal: database may already be pre-created via aaPanel
    }

    pool = mysql.createPool(cfg);
    const conn = await pool.getConnection();
    try {
      for (const stmt of TABLE_STATEMENTS) {
        await conn.query(stmt);
      }
      // Ensure proof_channel_link column exists on pre-existing tables
      try {
        await conn.query("ALTER TABLE `settings` ADD COLUMN `proof_channel_link` VARCHAR(255) DEFAULT 'https://t.me/skyworkxcwdrl'");
      } catch (alterErr) {
        // Ignore duplicate column error (ER_DUP_FIELDNAME)
      }
      mysqlConnected = true;
      console.log(`[MySQL] Connected to ${cfg.host}:${cfg.port}/${cfg.database} and verified all 14 tables.`);
    } finally {
      conn.release();
    }
    return true;
  } catch (err) {
    console.error('[MySQL] Connection failed:', err.message);
    mysqlConnected = false;
    return false;
  }
}

async function loadFromMysql() {
  if (!mysqlConnected || !pool) return null;

  try {
    const [
      [usersRows],
      [ordersRows],
      [bankRows],
      [txnRows],
      [taskRows],
      [msgRows],
      [withdrawalRows],
      [disputeRows],
      [productRows],
      [rangeRows],
      [sliderRows],
      [settingsRows],
      [adminRows],
      [trackerRows]
    ] = await Promise.all([
      pool.query('SELECT * FROM `users` ORDER BY `id` ASC'),
      pool.query('SELECT * FROM `orders` ORDER BY `id` ASC'),
      pool.query('SELECT * FROM `bank_accounts` ORDER BY `id` ASC'),
      pool.query('SELECT * FROM `transactions` ORDER BY `id` ASC'),
      pool.query('SELECT * FROM `user_tasks` ORDER BY `id` ASC'),
      pool.query('SELECT * FROM `messages` ORDER BY `id` ASC'),
      pool.query('SELECT * FROM `withdrawals` ORDER BY `id` ASC'),
      pool.query('SELECT * FROM `disputes` ORDER BY `id` ASC'),
      pool.query('SELECT * FROM `products` ORDER BY `id` ASC'),
      pool.query('SELECT * FROM `price_ranges` ORDER BY `id` ASC'),
      pool.query('SELECT * FROM `sliders` ORDER BY `id` ASC'),
      pool.query('SELECT * FROM `settings` WHERE `id` = 1'),
      pool.query('SELECT * FROM `admins` WHERE `id` = 1'),
      pool.query('SELECT * FROM `id_trackers`')
    ]);

    if (usersRows.length === 0) {
      console.log('[MySQL] Database tables are empty. Ready for initial seeding.');
      return null;
    }

    const dbData = {
      users: usersRows.map(r => {
        const extra = parseJsonField(r.extra_json, {});
        return {
          ...extra,
          id: Number(r.id),
          uid: r.uid,
          username: r.username,
          mobile: r.mobile,
          password_hash: r.password_hash,
          pin: r.pin,
          ref_code: r.ref_code,
          parent_id: r.parent_id !== null ? Number(r.parent_id) : null,
          inr_balance: Number(r.inr_balance || 0),
          bcoin_balance: Number(r.bcoin_balance || 0),
          usdt_balance: Number(r.usdt_balance || 0),
          total_earnings: Number(r.total_earnings || 0),
          today_profit: Number(r.today_profit || 0),
          yesterday_profit: Number(r.yesterday_profit || 0),
          is_blocked: Boolean(r.is_blocked),
          fcm_tokens: parseJsonField(r.fcm_tokens, []),
          created_at: r.created_at
        };
      }),
      orders: ordersRows.map(r => {
        const extra = parseJsonField(r.extra_json, {});
        return {
          ...extra,
          id: Number(r.id),
          order_id: r.order_id,
          user_id: Number(r.user_id),
          receiver_id: r.receiver_id !== null ? Number(r.receiver_id) : null,
          asset_type: r.asset_type,
          amount: Number(r.amount || 0),
          expected_income: Number(r.expected_income || 0),
          quota: Number(r.quota || 0),
          status: r.status,
          utr: r.utr,
          proof_image: r.proof_image,
          created_at: r.created_at
        };
      }),
      bank_accounts: bankRows.map(r => {
        const extra = parseJsonField(r.extra_json, {});
        return {
          ...extra,
          id: Number(r.id),
          user_id: Number(r.user_id),
          bank_name: r.bank_name,
          account_holder: r.account_holder,
          account_number: r.account_number,
          ifsc_code: r.ifsc_code,
          status: r.status,
          created_at: r.created_at
        };
      }),
      transactions: txnRows.map(r => {
        const extra = parseJsonField(r.extra_json, {});
        return {
          ...extra,
          id: Number(r.id),
          user_id: Number(r.user_id),
          type: r.type,
          amount: Number(r.amount || 0),
          balance_after: Number(r.balance_after || 0),
          description: r.description,
          created_at: r.created_at
        };
      }),
      user_tasks: taskRows.map(r => ({
        id: Number(r.id),
        user_id: Number(r.user_id),
        task_key: r.task_key,
        completed: Number(r.completed || 0),
        claimed: Number(r.claimed || 0),
        created_at: r.created_at
      })),
      messages: msgRows.map(r => ({
        id: Number(r.id),
        title: r.title,
        content: r.content,
        created_at: r.created_at
      })),
      withdrawals: withdrawalRows.map(r => {
        const extra = parseJsonField(r.extra_json, {});
        return {
          ...extra,
          id: Number(r.id),
          user_id: Number(r.user_id),
          amount: Number(r.amount || 0),
          status: r.status,
          utr: r.utr,
          created_at: r.created_at
        };
      }),
      disputes: disputeRows.map(r => {
        const extra = parseJsonField(r.extra_json, {});
        return {
          ...extra,
          id: Number(r.id),
          order_id: r.order_id,
          user_id: Number(r.user_id),
          reason: r.reason,
          status: r.status,
          created_at: r.created_at
        };
      }),
      products: productRows.map(r => ({
        id: Number(r.id),
        name: r.name,
        amount: Number(r.amount || 0),
        income: Number(r.income || 0),
        quota: Number(r.quota || 0),
        color: r.color,
        type: r.type,
        percent: r.percent,
        created_at: r.created_at
      })),
      price_ranges: rangeRows.map(r => ({
        id: Number(r.id),
        label: r.label,
        min_val: Number(r.min_val || 0),
        max_val: Number(r.max_val || 0),
        created_at: r.created_at
      })),
      sliders: sliderRows.map(r => ({
        id: Number(r.id),
        image_data: r.image_data,
        created_at: r.created_at
      })),
      settings: settingsRows.length > 0 ? {
        ...parseJsonField(settingsRows[0].extra_json, {}),
        level1_commission: Number(settingsRows[0].level1_commission || 5),
        level2_commission: Number(settingsRows[0].level2_commission || 2.5),
        level3_commission: Number(settingsRows[0].level3_commission || 2),
        telegram_link: settingsRows[0].telegram_link,
        proof_channel_link: settingsRows[0].proof_channel_link || 'https://t.me/skyworkxcwdrl',
        payment_mode: settingsRows[0].payment_mode,
        upi_ids: settingsRows[0].upi_ids || '',
        winpey_api_key: settingsRows[0].winpey_api_key,
        winpey_api_secret: settingsRows[0].winpey_api_secret,
        orders_repaired_v2: Boolean(settingsRows[0].orders_repaired_v2),
        history_split_repaired: Boolean(settingsRows[0].history_split_repaired)
      } : {},
      admin: adminRows.length > 0 ? {
        username: adminRows[0].username,
        password: adminRows[0].password
      } : { username: 'admin', password: '123456' }
    };

    const idTrackers = {};
    for (const row of trackerRows) {
      idTrackers[row.table_name] = Number(row.last_id || 0);
    }

    console.log(`[MySQL] Loaded ${dbData.users.length} users, ${dbData.orders.length} orders, ${dbData.products.length} products from MySQL.`);
    return { dbData, idTrackers };
  } catch (err) {
    console.error('[MySQL] Error loading from MySQL:', err.message);
    return null;
  }
}

let isSyncing = false;
let pendingSync = null;

async function syncTableRows(conn, tableName, items, columns, mapRowFn) {
  if (!items || items.length === 0) {
    await conn.query(`DELETE FROM \`${tableName}\``);
    return;
  }

  const ids = items.map(i => Number(i.id));
  await conn.query(`DELETE FROM \`${tableName}\` WHERE \`id\` NOT IN (?)`, [ids]);

  const colList = columns.map(c => `\`${c}\``).join(', ');
  const updateList = columns
    .filter(c => c !== 'id')
    .map(c => `\`${c}\` = VALUES(\`${c}\`)`)
    .join(', ');

  const chunkSize = 200;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const values = chunk.map(mapRowFn);
    await conn.query(
      `INSERT INTO \`${tableName}\` (${colList}) VALUES ? ON DUPLICATE KEY UPDATE ${updateList}`,
      [values]
    );
  }
}

async function syncToMysql(dbData, idTrackers) {
  if (!mysqlConnected || !pool) return;

  if (isSyncing) {
    pendingSync = { dbData, idTrackers };
    return;
  }

  isSyncing = true;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Users
    const userCols = ['id', 'uid', 'username', 'mobile', 'password_hash', 'pin', 'ref_code', 'parent_id', 'inr_balance', 'bcoin_balance', 'usdt_balance', 'total_earnings', 'today_profit', 'yesterday_profit', 'is_blocked', 'fcm_tokens', 'created_at', 'extra_json'];
    await syncTableRows(conn, 'users', dbData.users || [], userCols, u => [
      Number(u.id),
      u.uid || '',
      u.username || null,
      u.mobile || '',
      u.password_hash || '',
      u.pin || null,
      u.ref_code || null,
      u.parent_id !== null && u.parent_id !== undefined ? Number(u.parent_id) : null,
      Number(u.inr_balance || 0),
      Number(u.bcoin_balance || 0),
      Number(u.usdt_balance || 0),
      Number(u.total_earnings || 0),
      Number(u.today_profit || 0),
      Number(u.yesterday_profit || 0),
      u.is_blocked ? 1 : 0,
      u.fcm_tokens ? JSON.stringify(u.fcm_tokens) : null,
      u.created_at || null,
      stripExtra(u, userCols)
    ]);

    // 2. Orders
    const orderCols = ['id', 'order_id', 'user_id', 'receiver_id', 'asset_type', 'amount', 'expected_income', 'quota', 'status', 'utr', 'proof_image', 'created_at', 'extra_json'];
    await syncTableRows(conn, 'orders', dbData.orders || [], orderCols, o => [
      Number(o.id),
      o.order_id || '',
      Number(o.user_id || 0),
      o.receiver_id !== null && o.receiver_id !== undefined ? Number(o.receiver_id) : null,
      o.asset_type || 'INR',
      Number(o.amount || 0),
      Number(o.expected_income || 0),
      Number(o.quota || 0),
      o.status || 'Pending',
      o.utr || null,
      o.proof_image || null,
      o.created_at || null,
      stripExtra(o, orderCols)
    ]);

    // 3. Bank Accounts
    const bankCols = ['id', 'user_id', 'bank_name', 'account_holder', 'account_number', 'ifsc_code', 'status', 'created_at', 'extra_json'];
    await syncTableRows(conn, 'bank_accounts', dbData.bank_accounts || [], bankCols, b => [
      Number(b.id),
      Number(b.user_id || 0),
      b.bank_name || null,
      b.account_holder || null,
      b.account_number || null,
      b.ifsc_code || null,
      b.status || 'Active',
      b.created_at || null,
      stripExtra(b, bankCols)
    ]);

    // 4. Transactions
    const txnCols = ['id', 'user_id', 'type', 'amount', 'balance_after', 'description', 'created_at', 'extra_json'];
    await syncTableRows(conn, 'transactions', dbData.transactions || [], txnCols, t => [
      Number(t.id),
      Number(t.user_id || 0),
      t.type || null,
      Number(t.amount || 0),
      Number(t.balance_after || 0),
      t.description || null,
      t.created_at || null,
      stripExtra(t, txnCols)
    ]);

    // 5. User Tasks
    const taskCols = ['id', 'user_id', 'task_key', 'completed', 'claimed', 'created_at'];
    await syncTableRows(conn, 'user_tasks', dbData.user_tasks || [], taskCols, t => [
      Number(t.id),
      Number(t.user_id || 0),
      t.task_key || '',
      t.completed ? 1 : 0,
      t.claimed ? 1 : 0,
      t.created_at || null
    ]);

    // 6. Messages
    const msgCols = ['id', 'title', 'content', 'created_at'];
    await syncTableRows(conn, 'messages', dbData.messages || [], msgCols, m => [
      Number(m.id),
      m.title || null,
      m.content || null,
      m.created_at || null
    ]);

    // 7. Withdrawals
    const wCols = ['id', 'user_id', 'amount', 'status', 'utr', 'created_at', 'extra_json'];
    await syncTableRows(conn, 'withdrawals', dbData.withdrawals || [], wCols, w => [
      Number(w.id),
      Number(w.user_id || 0),
      Number(w.amount || 0),
      w.status || 'Pending',
      w.utr || null,
      w.created_at || null,
      stripExtra(w, wCols)
    ]);

    // 8. Disputes
    const dCols = ['id', 'order_id', 'user_id', 'reason', 'status', 'created_at', 'extra_json'];
    await syncTableRows(conn, 'disputes', dbData.disputes || [], dCols, d => [
      Number(d.id),
      d.order_id || null,
      Number(d.user_id || 0),
      d.reason || null,
      d.status || 'Open',
      d.created_at || null,
      stripExtra(d, dCols)
    ]);

    // 9. Products
    const prodCols = ['id', 'name', 'amount', 'income', 'quota', 'color', 'type', 'percent', 'created_at'];
    await syncTableRows(conn, 'products', dbData.products || [], prodCols, p => [
      Number(p.id),
      p.name || null,
      Number(p.amount || 0),
      Number(p.income || 0),
      Number(p.quota || 0),
      p.color || 'blue',
      p.type || 'Bank',
      p.percent || null,
      p.created_at || null
    ]);

    // 10. Price Ranges
    const rangeCols = ['id', 'label', 'min_val', 'max_val', 'created_at'];
    await syncTableRows(conn, 'price_ranges', dbData.price_ranges || [], rangeCols, r => [
      Number(r.id),
      r.label || null,
      Number(r.min_val || 0),
      Number(r.max_val || 0),
      r.created_at || null
    ]);

    // 11. Sliders
    const sliderCols = ['id', 'image_data', 'created_at'];
    await syncTableRows(conn, 'sliders', dbData.sliders || [], sliderCols, s => [
      Number(s.id),
      s.image_data || null,
      s.created_at || null
    ]);

    // 12. Settings
    const s = dbData.settings || {};
    const settingKnown = ['id', 'level1_commission', 'level2_commission', 'level3_commission', 'telegram_link', 'proof_channel_link', 'payment_mode', 'upi_ids', 'winpey_api_key', 'winpey_api_secret', 'orders_repaired_v2', 'history_split_repaired'];
    await conn.query(
      `INSERT INTO \`settings\` (id, level1_commission, level2_commission, level3_commission, telegram_link, proof_channel_link, payment_mode, upi_ids, winpey_api_key, winpey_api_secret, orders_repaired_v2, history_split_repaired, extra_json)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       level1_commission=VALUES(level1_commission), level2_commission=VALUES(level2_commission), level3_commission=VALUES(level3_commission),
       telegram_link=VALUES(telegram_link), proof_channel_link=VALUES(proof_channel_link), payment_mode=VALUES(payment_mode), upi_ids=VALUES(upi_ids),
       winpey_api_key=VALUES(winpey_api_key), winpey_api_secret=VALUES(winpey_api_secret),
       orders_repaired_v2=VALUES(orders_repaired_v2), history_split_repaired=VALUES(history_split_repaired), extra_json=VALUES(extra_json)`,
      [
        Number(s.level1_commission ?? 5),
        Number(s.level2_commission ?? 2.5),
        Number(s.level3_commission ?? 2),
        s.telegram_link || 'https://t.me/SkyWork',
        s.proof_channel_link || 'https://t.me/skyworkxcwdrl',
        s.payment_mode || 'manual',
        s.upi_ids || '',
        s.winpey_api_key || null,
        s.winpey_api_secret || null,
        s.orders_repaired_v2 ? 1 : 0,
        s.history_split_repaired ? 1 : 0,
        stripExtra(s, settingKnown)
      ]
    );

    // 13. Admin
    const adm = dbData.admin || { username: 'admin', password: '123456' };
    await conn.query(
      `INSERT INTO \`admins\` (id, username, password) VALUES (1, ?, ?)
       ON DUPLICATE KEY UPDATE username=VALUES(username), password=VALUES(password)`,
      [adm.username || 'admin', adm.password || '123456']
    );

    // 14. ID Trackers
    const trackerEntries = Object.entries(idTrackers || {});
    if (trackerEntries.length > 0) {
      const tVals = trackerEntries.map(([k, v]) => [k, Number(v || 0)]);
      await conn.query(
        `INSERT INTO \`id_trackers\` (table_name, last_id) VALUES ?
         ON DUPLICATE KEY UPDATE last_id=VALUES(last_id)`,
        [tVals]
      );
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    console.error('[MySQL] Transaction sync error:', err.message);
  } finally {
    conn.release();
    isSyncing = false;
    if (pendingSync) {
      const next = pendingSync;
      pendingSync = null;
      await syncToMysql(next.dbData, next.idTrackers);
    }
  }
}

module.exports = {
  initMysql,
  isMysqlConnected: () => mysqlConnected,
  loadFromMysql,
  syncToMysql,
  getPool: () => pool
};
