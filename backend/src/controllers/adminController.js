const jwt = require('jsonwebtoken');
const { query } = require('../db');

exports.adminLogin = async (req, res) => {
  const { username, password } = req.body;

  const { loadDb, dbData } = require('../db');
  loadDb();
  dbData.admin = dbData.admin || {
    username: process.env.ADMIN_USER || 'admin',
    password: process.env.ADMIN_PASS || 'demo123456'
  };

  const expectedUser = dbData.admin.username;
  const expectedPass = dbData.admin.password;

  if (username === expectedUser && password === expectedPass) {
    const token = jwt.sign(
      { username, role: 'admin' },
      process.env.JWT_SECRET || 'SkyWork_secret_jwt_key',
      { expiresIn: '24h' }
    );
    return res.status(200).json({
      success: true,
      message: 'Admin login successful',
      token
    });
  } else {
    return res.status(401).json({
      success: false,
      error: 'Invalid administrator username or password.'
    });
  }
};

exports.changeAdminPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'Please fill current password, new password and confirm password.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New password and confirm password do not match.' });
    }

    if (newPassword.length < 5) {
      return res.status(400).json({ error: 'New password must be at least 5 characters long.' });
    }

    const { loadDb, dbData, saveDb } = require('../db');
    loadDb();
    dbData.admin = dbData.admin || {
      username: process.env.ADMIN_USER || 'admin',
      password: process.env.ADMIN_PASS || 'demo123456'
    };

    if (currentPassword !== dbData.admin.password) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    dbData.admin.password = newPassword;
    saveDb();

    return res.status(200).json({
      success: true,
      message: 'Administrator password updated successfully! Please use your new password for future logins.'
    });
  } catch (error) {
    console.error('Error changing admin password:', error);
    return res.status(500).json({ error: 'Internal server error while updating administrator password.' });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const userCount = await query.get('SELECT COUNT(*) as count FROM users');
    const depositVolume = await query.get('SELECT SUM(amount) as sum FROM orders WHERE status = "Completed"');
    const pendingCount = await query.get('SELECT COUNT(*) as count FROM orders WHERE status = "Confirming"');
    const completedCount = await query.get('SELECT COUNT(*) as count FROM orders WHERE status = "Completed"');
    const canceledCount = await query.get('SELECT COUNT(*) as count FROM orders WHERE status = "Canceled"');

    // 1. Calculate withdrawals
    const txns = await query.all('SELECT amount, type FROM transactions WHERE type = "Withdraw"');
    const totalWithdrawals = txns.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // 2. Active plans breakdown
    const products = await query.all('SELECT * FROM products');
    const completedOrders = await query.all('SELECT * FROM orders WHERE status = "Completed"');
    const activePlansBreakdown = products.map(p => {
      const matchingOrders = completedOrders.filter(o => Math.abs(o.amount - p.amount) < 0.01);
      return {
        id: p.id,
        name: p.name,
        amount: p.amount,
        type: p.type,
        count: matchingOrders.length,
        totalValue: matchingOrders.reduce((sum, o) => sum + o.amount, 0)
      };
    });

    // 3. Generate 7-day chart data
    const chartData = [];
    const allOrders = await query.all('SELECT amount, status, created_at FROM orders');
    const allTxns = await query.all('SELECT amount, type, created_at FROM transactions WHERE type = "Withdraw"');
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateString = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      
      const dayDeposits = allOrders.filter(o => {
        if (o.status !== 'Completed') return false;
        return o.created_at && o.created_at.startsWith(dateString);
      }).reduce((sum, o) => sum + o.amount, 0);
      
      const dayWithdrawals = allTxns.filter(t => {
        return t.amount < 0 && t.created_at && t.created_at.startsWith(dateString);
      }).reduce((sum, t) => sum + Math.abs(t.amount), 0);
      
      chartData.push({
        date: label,
        deposits: dayDeposits,
        withdrawals: dayWithdrawals
      });
    }

    return res.status(200).json({
      success: true,
      stats: {
        totalUsers: userCount?.count || 0,
        totalVolume: depositVolume?.sum || 0,
        totalDeposits: depositVolume?.sum || 0,
        totalWithdrawals,
        totalActivePlans: depositVolume?.sum || 0,
        pendingOrders: pendingCount?.count || 0,
        completedOrders: completedCount?.count || 0,
        canceledOrders: canceledCount?.count || 0,
        activePlansBreakdown,
        chartData
      }
    });
  } catch (error) {
    console.error('Error fetching admin dashboard statistics:', error);
    return res.status(500).json({ error: 'Internal server error while building statistics.' });
  }
};

exports.getUsersList = async (req, res) => {
  try {
    const users = await query.all('SELECT id, uid, username, mobile, inr_balance, bcoin_balance, total_earnings, today_profit, is_blocked, created_at FROM users ORDER BY id DESC');
    
    // 1. Fetch total withdrawals for all users
    const withdrawals = await query.all('SELECT user_id, amount FROM transactions WHERE type = "Withdraw"');
    const withdrawalMap = {};
    withdrawals.forEach(w => {
      withdrawalMap[w.user_id] = (withdrawalMap[w.user_id] || 0) + Math.abs(w.amount || 0);
    });

    // 2. Fetch bank accounts for all users
    const bankAccounts = await query.all('SELECT * FROM bank_accounts');
    const bankMap = {};
    bankAccounts.forEach(acc => {
      if (acc.status === 'Active' || !bankMap[acc.user_id]) {
        bankMap[acc.user_id] = {
          bank_name: acc.bank_name,
          account_holder: acc.account_holder,
          account_number: acc.account_number,
          ifsc_code: acc.ifsc_code
        };
      }
    });

    // Enrich users with total_withdrawals and bank_details
    users.forEach(u => {
      u.total_withdrawals = withdrawalMap[u.id] || 0;
      u.bank_details = bankMap[u.id] || null;
      u.is_blocked = u.is_blocked || false;
    });

    return res.status(200).json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Error fetching user list:', error);
    return res.status(500).json({ error: 'Internal server error while loading users directory.' });
  }
};

exports.toggleUserBlock = async (req, res) => {
  try {
    const { id } = req.params;
    const { loadDb, dbData, saveDb } = require('../db');
    loadDb();
    const user = dbData.users.find(u => u.id == id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const newBlockedState = !user.is_blocked;
    user.is_blocked = newBlockedState;
    saveDb();

    // Update SQLite database to keep SQLite & dbData in sync
    await query.run('UPDATE users SET is_blocked = ? WHERE id = ?', [newBlockedState ? 1 : 0, id]);

    return res.status(200).json({
      success: true,
      is_blocked: newBlockedState,
      message: newBlockedState ? `User UID ${user.uid} (${user.mobile}) has been BLOCKED by admin.` : `User UID ${user.uid} (${user.mobile}) has been UNBLOCKED.`
    });
  } catch (error) {
    console.error('Error toggling user block status:', error);
    return res.status(500).json({ error: 'Internal server error while updating user block status.' });
  }
};

exports.getReportsData = async (req, res) => {
  try {
    const { loadDb, dbData } = require('../db');
    loadDb();

    const type = req.query.type || 'daily';
    const requestedDate = req.query.date || new Date().toISOString().split('T')[0];
    const requestedMonth = req.query.month || (req.query.date ? req.query.date.substring(0, 7) : new Date().toISOString().substring(0, 7));

    const allOrders = dbData.orders || [];
    const allTxns = dbData.transactions || [];
    const allUsers = dbData.users || [];

    const userMap = {};
    allUsers.forEach(u => {
      userMap[u.id] = { uid: u.uid, mobile: u.mobile, username: u.username };
    });

    // 1. Build chronological completed order history to determine deposit sequence (1st = FTD, 2+ = Recurring)
    const completedOrders = allOrders
      .filter(o => o.status === 'Completed' && o.created_at)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    const userOrderSequence = {};
    const orderMetaMap = {};

    for (const o of completedOrders) {
      const uId = String(o.user_id || o.user_uid || '');
      if (!userOrderSequence[uId]) {
        userOrderSequence[uId] = 0;
      }
      userOrderSequence[uId]++;
      const seq = userOrderSequence[uId];
      const orderKey = String(o.id || o.order_id || '');
      orderMetaMap[orderKey] = {
        sequence: seq,
        isRecurring: seq > 1
      };
    }

    for (const o of completedOrders) {
      const uId = String(o.user_id || o.user_uid || '');
      const orderKey = String(o.id || o.order_id || '');
      if (orderMetaMap[orderKey]) {
        orderMetaMap[orderKey].userTotalCompleted = userOrderSequence[uId] || 1;
      }
    }

    // Helper to compute deposit volume, recurring metrics, and retention rate for a set of completed deposit orders
    const computeDepositMetrics = (ordersList) => {
      const total = ordersList.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
      const count = ordersList.length;

      let recurringAmt = 0;
      let recurringCnt = 0;
      let ftdAmt = 0;
      let ftdCnt = 0;

      const depositorsSet = new Set();
      const recurringUsersSet = new Set();
      const ftdUsersSet = new Set();

      for (const o of ordersList) {
        const amt = Number(o.amount) || 0;
        const orderKey = String(o.id || o.order_id || '');
        const meta = orderMetaMap[orderKey] || { sequence: 1, isRecurring: false, userTotalCompleted: 1 };
        const uId = String(o.user_id || o.user_uid || '');

        depositorsSet.add(uId);

        if (meta.isRecurring) {
          recurringAmt += amt;
          recurringCnt++;
          recurringUsersSet.add(uId);
        } else {
          ftdAmt += amt;
          ftdCnt++;
          ftdUsersSet.add(uId);
        }
      }

      const uniqueDepositors = depositorsSet.size;
      const uniqueRecurringUsers = recurringUsersSet.size;
      const uniqueFtdUsers = ftdUsersSet.size;

      const recurringDepositPct = total > 0 ? Number(((recurringAmt / total) * 100).toFixed(1)) : 0;
      const ftdDepositPct = total > 0 ? Number(((ftdAmt / total) * 100).toFixed(1)) : 0;
      const retentionRate = uniqueDepositors > 0 ? Number(((uniqueRecurringUsers / uniqueDepositors) * 100).toFixed(1)) : 0;

      return {
        totalDeposits: total,
        depositCount: count,
        recurringDeposits: recurringAmt,
        recurringDepositCount: recurringCnt,
        recurringDepositPct,
        ftdDeposits: ftdAmt,
        ftdDepositCount: ftdCnt,
        ftdDepositPct,
        uniqueDepositors,
        uniqueRecurringUsers,
        uniqueFtdUsers,
        retentionRate
      };
    };

    if (type === 'daily') {
      // 1. Completed Deposits on this date
      const dayDeposits = allOrders.filter(o => 
        o.status === 'Completed' && 
        o.created_at && 
        o.created_at.startsWith(requestedDate)
      );

      const depMetrics = computeDepositMetrics(dayDeposits);

      // 2. Withdrawals on this date (type === 'Withdraw' and amount < 0)
      const dayWithdrawals = allTxns.filter(t => 
        t.type === 'Withdraw' && 
        Number(t.amount) < 0 && 
        t.created_at && 
        t.created_at.startsWith(requestedDate)
      );

      const totalWithdrawals = dayWithdrawals.reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);
      const withdrawalCount = dayWithdrawals.length;

      // 3. New Users registered on this date
      const dayUsers = allUsers.filter(u => 
        u.created_at && 
        u.created_at.startsWith(requestedDate)
      );
      const newUsersCount = dayUsers.length;

      // 4. Net Cashflow
      const netCashflow = depMetrics.totalDeposits - totalWithdrawals;

      // 5. Itemized lists
      const enrichedDeposits = dayDeposits.map(o => {
        const orderKey = String(o.id || o.order_id || '');
        const meta = orderMetaMap[orderKey] || { sequence: 1, isRecurring: false, userTotalCompleted: 1 };
        return {
          id: o.id,
          order_id: o.order_id,
          user_id: o.user_id,
          user_uid: o.user_uid || (userMap[o.user_id]?.uid) || 'N/A',
          user_mobile: o.user_mobile || (userMap[o.user_id]?.mobile) || 'N/A',
          amount: Number(o.amount) || 0,
          utr: o.utr || 'N/A',
          status: o.status,
          is_recurring: meta.isRecurring,
          deposit_sequence: meta.sequence,
          user_total_deposits: meta.userTotalCompleted,
          created_at: o.created_at
        };
      });

      const enrichedWithdrawals = dayWithdrawals.map(t => ({
        id: t.id,
        user_id: t.user_id,
        user_uid: (userMap[t.user_id]?.uid) || 'N/A',
        user_mobile: (userMap[t.user_id]?.mobile) || 'N/A',
        amount: Math.abs(Number(t.amount) || 0),
        description: t.description || 'Withdrawal Debit',
        created_at: t.created_at
      }));

      const enrichedUsers = dayUsers.map(u => ({
        id: u.id,
        uid: u.uid,
        mobile: u.mobile,
        username: u.username || 'User',
        inr_balance: u.inr_balance || 0,
        bcoin_balance: u.bcoin_balance || 0,
        created_at: u.created_at
      }));

      return res.status(200).json({
        success: true,
        type: 'daily',
        date: requestedDate,
        summary: {
          ...depMetrics,
          totalWithdrawals,
          withdrawalCount,
          netCashflow,
          newUsersCount
        },
        drilldown: {
          deposits: enrichedDeposits,
          withdrawals: enrichedWithdrawals,
          newUsers: enrichedUsers
        }
      });
    } else if (type === 'weekly') {
      // Weekly Report (Past 7 days up to requestedDate)
      const anchor = new Date(requestedDate);
      const daysList = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(anchor);
        d.setDate(anchor.getDate() - i);
        daysList.push(d.toISOString().split('T')[0]);
      }

      const dailyBreakdown = [];
      const allPeriodDeposits = [];
      let totalWithdrawals = 0;
      let withdrawalCount = 0;
      let newUsersCount = 0;

      for (const dKey of daysList) {
        const dDeps = allOrders.filter(o => 
          o.status === 'Completed' && 
          o.created_at && 
          o.created_at.startsWith(dKey)
        );
        allPeriodDeposits.push(...dDeps);
        const depMetrics = computeDepositMetrics(dDeps);

        const dWiths = allTxns.filter(t => 
          t.type === 'Withdraw' && 
          Number(t.amount) < 0 && 
          t.created_at && 
          t.created_at.startsWith(dKey)
        );
        const dWithsSum = dWiths.reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);
        const dWithsCnt = dWiths.length;

        const dUsers = allUsers.filter(u => 
          u.created_at && 
          u.created_at.startsWith(dKey)
        );
        const dUsersCnt = dUsers.length;

        totalWithdrawals += dWithsSum;
        withdrawalCount += dWithsCnt;
        newUsersCount += dUsersCnt;

        const dayName = new Date(dKey).toLocaleDateString('en-US', { weekday: 'short' });

        dailyBreakdown.push({
          date: dKey,
          day: dayName,
          deposits: depMetrics.totalDeposits,
          depositCount: depMetrics.depositCount,
          recurringDeposits: depMetrics.recurringDeposits,
          recurringDepositCount: depMetrics.recurringDepositCount,
          recurringDepositPct: depMetrics.recurringDepositPct,
          retentionRate: depMetrics.retentionRate,
          withdrawals: dWithsSum,
          withdrawalCount: dWithsCnt,
          netCashflow: depMetrics.totalDeposits - dWithsSum,
          newUsers: dUsersCnt
        });
      }

      const totalPeriodMetrics = computeDepositMetrics(allPeriodDeposits);
      const netCashflow = totalPeriodMetrics.totalDeposits - totalWithdrawals;

      return res.status(200).json({
        success: true,
        type: 'weekly',
        startDate: daysList[0],
        endDate: daysList[daysList.length - 1],
        summary: {
          ...totalPeriodMetrics,
          totalWithdrawals,
          withdrawalCount,
          netCashflow,
          newUsersCount
        },
        dailyBreakdown
      });
    } else {
      // Monthly Report
      const monthPrefix = requestedMonth;
      const [year, month] = monthPrefix.split('-').map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();

      const dailyBreakdown = [];
      const allMonthDeposits = [];
      let totalWithdrawals = 0;
      let withdrawalCount = 0;
      let newUsersCount = 0;

      for (let day = 1; day <= daysInMonth; day++) {
        const dayStr = day < 10 ? `0${day}` : `${day}`;
        const dateKey = `${monthPrefix}-${dayStr}`;

        const dDeps = allOrders.filter(o => 
          o.status === 'Completed' && 
          o.created_at && 
          o.created_at.startsWith(dateKey)
        );
        allMonthDeposits.push(...dDeps);
        const depMetrics = computeDepositMetrics(dDeps);

        const dWiths = allTxns.filter(t => 
          t.type === 'Withdraw' && 
          Number(t.amount) < 0 && 
          t.created_at && 
          t.created_at.startsWith(dateKey)
        );
        const dWithsSum = dWiths.reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);
        const dWithsCnt = dWiths.length;

        const dUsers = allUsers.filter(u => 
          u.created_at && 
          u.created_at.startsWith(dateKey)
        );
        const dUsersCnt = dUsers.length;

        totalWithdrawals += dWithsSum;
        withdrawalCount += dWithsCnt;
        newUsersCount += dUsersCnt;

        dailyBreakdown.push({
          date: dateKey,
          day: day,
          deposits: depMetrics.totalDeposits,
          depositCount: depMetrics.depositCount,
          recurringDeposits: depMetrics.recurringDeposits,
          recurringDepositCount: depMetrics.recurringDepositCount,
          recurringDepositPct: depMetrics.recurringDepositPct,
          retentionRate: depMetrics.retentionRate,
          withdrawals: dWithsSum,
          withdrawalCount: dWithsCnt,
          netCashflow: depMetrics.totalDeposits - dWithsSum,
          newUsers: dUsersCnt
        });
      }

      const totalMonthMetrics = computeDepositMetrics(allMonthDeposits);
      const netCashflow = totalMonthMetrics.totalDeposits - totalWithdrawals;

      return res.status(200).json({
        success: true,
        type: 'monthly',
        month: monthPrefix,
        summary: {
          ...totalMonthMetrics,
          totalWithdrawals,
          withdrawalCount,
          netCashflow,
          newUsersCount
        },
        dailyBreakdown
      });
    }
  } catch (error) {
    console.error('Error generating reports:', error);
    return res.status(500).json({ error: 'Internal server error while building financial reports.' });
  }
};

