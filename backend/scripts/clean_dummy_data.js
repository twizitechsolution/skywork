/**
 * clean_dummy_data.js
 * 
 * Safely audits and purges test/dummy deposits and withdrawals (~11 Lakh test volume)
 * generated during development and early testing of Airwallex.
 * 
 * Usage:
 *   node clean_dummy_data.js --dry-run
 *   node clean_dummy_data.js --execute
 */

const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../data/database.json');

if (!fs.existsSync(dbPath)) {
  console.error(`Database file not found at: ${dbPath}`);
  process.exit(1);
}

const isExecute = process.argv.includes('--execute');
const isDryRun = !isExecute;

console.log('===============================================================');
console.log(` Airwallex Database Dummy Data Cleaner [${isExecute ? 'EXECUTE MODE' : 'DRY RUN MODE'}]`);
console.log('===============================================================');

// 1. Read database
const rawContent = fs.readFileSync(dbPath, 'utf8');
const data = JSON.parse(rawContent);

const dbData = data.dbData || data;
const orders = dbData.orders || [];
const transactions = dbData.transactions || [];
const users = dbData.users || [];

console.log(`Initial records: ${users.length} users, ${orders.length} orders, ${transactions.length} transactions`);

// Calculate initial completed deposits & withdrawals
const initCompletedOrders = orders.filter(o => o.status === 'Completed');
const initDepSum = initCompletedOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

const initWithdrawals = transactions.filter(t => t.type === 'Withdraw' && Number(t.amount) < 0);
const initWithSum = initWithdrawals.reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);

console.log(`Initial Completed Deposits: ₹${initDepSum.toLocaleString('en-IN')} (${initCompletedOrders.length} orders)`);
console.log(`Initial Withdrawals: ₹${initWithSum.toLocaleString('en-IN')} (${initWithdrawals.length} transactions)`);
console.log('---------------------------------------------------------------');

// Helper function to test if an order is dummy/test
function isTestOrder(order) {
  const uid = Number(order.user_id);
  const utr = String(order.utr || '');
  const amt = Number(order.amount) || 0;

  // 1. Test users (Admin user 1, seed test user 2, dummy test user 8, test user 32)
  if ([1, 2, 8, 32].includes(uid)) return true;

  // 2. Orders with test UTR pattern (99654361..., keyboard smash patterns like 8283727...)
  if (/^99654361/.test(utr)) return true;
  if (/^(.)\1{4,}/.test(utr)) return true; // 5 or more identical repeated chars
  if (/^(12345|11111|99999|88888)/.test(utr)) return true;

  // 3. Pre-launch July 2026 orders
  if (order.created_at && order.created_at.startsWith('2026-07')) return true;

  return false;
}

// Helper function to test if a transaction is dummy/test
function isTestTransaction(t) {
  const uid = Number(t.user_id);
  const desc = String(t.description || '');
  const amt = Math.abs(Number(t.amount) || 0);

  // 1. Admin account self-test withdrawals (User 1)
  if (uid === 1) return true;

  // 2. Test users (2, 8, 32)
  if ([2, 8, 32].includes(uid)) return true;

  // 3. Early July test entries
  if (t.created_at && t.created_at.startsWith('2026-07')) return true;

  // 4. Test UTR in description
  if (/99654361/.test(desc) || /81818484848919191/.test(desc)) return true;

  return false;
}

// Filter out test orders & test transactions
const flaggedOrders = orders.filter(isTestOrder);
const flaggedCompletedOrders = flaggedOrders.filter(o => o.status === 'Completed');
const flaggedDepSum = flaggedCompletedOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

const flaggedTransactions = transactions.filter(isTestTransaction);
const flaggedWithdrawals = flaggedTransactions.filter(t => t.type === 'Withdraw');
const flaggedWithSum = flaggedWithdrawals.reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);

console.log(`Flagged Test Orders to Remove: ${flaggedOrders.length} (Completed: ${flaggedCompletedOrders.length}, Volume: ₹${flaggedDepSum.toLocaleString('en-IN')})`);
console.log(`Flagged Test Transactions to Remove: ${flaggedTransactions.length} (Withdrawals: ${flaggedWithdrawals.length}, Volume: ₹${flaggedWithSum.toLocaleString('en-IN')})`);

const cleanOrders = orders.filter(o => !isTestOrder(o));
const cleanTransactions = transactions.filter(t => !isTestTransaction(t));

const finalCompletedOrders = cleanOrders.filter(o => o.status === 'Completed');
const finalDepSum = finalCompletedOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

const finalWithdrawals = cleanTransactions.filter(t => t.type === 'Withdraw' && Number(t.amount) < 0);
const finalWithSum = finalWithdrawals.reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);

console.log('---------------------------------------------------------------');
console.log(`Remaining Authentic Completed Deposits: ₹${finalDepSum.toLocaleString('en-IN')} (${finalCompletedOrders.length} orders)`);
console.log(`Remaining Authentic Withdrawals: ₹${finalWithSum.toLocaleString('en-IN')} (${finalWithdrawals.length} transactions)`);
console.log(`Net Flow: ₹${(finalDepSum - finalWithSum).toLocaleString('en-IN')}`);
console.log('---------------------------------------------------------------');

if (isDryRun) {
  console.log('DRY RUN COMPLETE. No files were modified.');
  console.log('To apply these changes, run with: node clean_dummy_data.js --execute');
} else {
  // 1. Create timestamped backup
  const timestamp = Date.now();
  const backupPath = `${dbPath}.bak.${timestamp}`;
  fs.writeFileSync(backupPath, rawContent, 'utf8');
  console.log(`Safety backup created at: ${backupPath}`);

  // 2. Update database structure
  dbData.orders = cleanOrders;
  dbData.transactions = cleanTransactions;

  // 3. Recalculate balances for test users (reset user 1, 8, 32)
  users.forEach(u => {
    if ([1, 2, 8, 32].includes(u.id)) {
      u.inr_balance = 0;
      u.bcoin_balance = 0;
      u.total_earnings = 0;
    }
  });

  data.dbData = dbData;

  // 4. Save cleaned database
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Cleaned database saved to: ${dbPath}`);
  console.log('===============================================================');
  console.log(' DATABASE CLEANUP COMPLETE SUCCESSFULLY!');
  console.log('===============================================================');
}
