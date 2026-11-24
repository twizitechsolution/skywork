import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = `${import.meta.env.VITE_API_URL || '/api'}/admin`;

const ReportsManager = ({ token, theme, Pagination }) => {
  const [reportType, setReportType] = useState('daily');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().substring(0, 7));
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Daily drilldown tab: 'deposits' | 'withdrawals' | 'newUsers'
  const [dailyTab, setDailyTab] = useState('deposits');
  // Deposits subfilter: 'all' | 'ftd' | 'recurring'
  const [depositFilter, setDepositFilter] = useState('all');

  // Pagination states (10 items per page)
  const [depPage, setDepPage] = useState(1);
  const [withPage, setWithPage] = useState(1);
  const [userPage, setUserPage] = useState(1);
  const [breakdownPage, setBreakdownPage] = useState(1);

  const isDark = theme === 'dark';
  const cardStyle = isDark ? 'bg-[#131427] border-[#1b1c34]/50' : 'bg-white border-slate-200';
  const controlStyle = isDark ? 'bg-[#181931] border-[#1b1c34] text-slate-200 focus:border-violet-500' : 'bg-slate-50 border-slate-200 text-slate-700 focus:border-violet-400';
  const titleColor = isDark ? 'text-white' : 'text-slate-800';
  const subtitleColor = isDark ? 'text-slate-400' : 'text-slate-500';
  const headerBg = isDark ? 'bg-[#181931] border-[#1b1c34]/60 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600';

  const formatCurrency = (val) => {
    return Number(val || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const fetchReports = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_BASE}/reports`, {
        params: {
          type: reportType,
          date: selectedDate,
          month: selectedMonth
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setReportData(res.data);
        setDepPage(1);
        setWithPage(1);
        setUserPage(1);
        setBreakdownPage(1);
      }
    } catch (err) {
      console.error('Failed to load reports:', err);
      setError(err.response?.data?.error || 'Failed to fetch financial report data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [reportType, selectedDate, selectedMonth]);

  // Quick preset handlers
  const setToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
    setReportType('daily');
  };

  const setYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
    setReportType('daily');
  };

  const setPast7Days = () => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
    setReportType('weekly');
  };

  const setThisMonth = () => {
    const thisMonth = new Date().toISOString().substring(0, 7);
    setSelectedMonth(thisMonth);
    setReportType('monthly');
  };

  const setLastMonth = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    setSelectedMonth(d.toISOString().substring(0, 7));
    setReportType('monthly');
  };

  const summary = reportData?.summary || {
    totalDeposits: 0,
    depositCount: 0,
    recurringDeposits: 0,
    recurringDepositCount: 0,
    recurringDepositPct: 0,
    ftdDeposits: 0,
    ftdDepositCount: 0,
    ftdDepositPct: 0,
    uniqueDepositors: 0,
    uniqueRecurringUsers: 0,
    retentionRate: 0,
    totalWithdrawals: 0,
    withdrawalCount: 0,
    netCashflow: 0,
    newUsersCount: 0
  };

  const drilldown = reportData?.drilldown || {
    deposits: [],
    withdrawals: [],
    newUsers: []
  };

  const dailyBreakdown = reportData?.dailyBreakdown || [];

  // Filter deposits by type
  const filteredDeposits = drilldown.deposits.filter((dep) => {
    if (depositFilter === 'ftd') return !dep.is_recurring;
    if (depositFilter === 'recurring') return dep.is_recurring;
    return true;
  });

  return (
    <div className="space-y-8 select-none">
      {/* Top Filter & Controls Container */}
      <div className={`border rounded-[1.8rem] p-6 shadow-md ${cardStyle}`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-violet-600/10 border border-violet-500/20 text-violet-400 flex items-center justify-center font-bold text-sm">
                <i className="fas fa-chart-pie" />
              </div>
              <h2 className={`text-base font-black uppercase tracking-wider ${titleColor}`}>
                Financial & Operational Reports
              </h2>
            </div>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${subtitleColor} mt-1`}>
              {reportType === 'daily'
                ? `Daily Statement for ${selectedDate}`
                : reportType === 'weekly'
                ? `Weekly Rolling Statement (${reportData?.startDate || ''} to ${reportData?.endDate || selectedDate})`
                : `Monthly Statement for ${selectedMonth}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Toggle: Daily | Weekly | Monthly */}
            <div className={`p-1 rounded-2xl border flex items-center gap-1 ${isDark ? 'bg-[#181931] border-[#1b1c34]' : 'bg-slate-100 border-slate-200'}`}>
              <button
                onClick={() => setReportType('daily')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                  reportType === 'daily'
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/20'
                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <i className="fas fa-calendar-day text-[10px]" /> Daily
              </button>
              <button
                onClick={() => setReportType('weekly')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                  reportType === 'weekly'
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/20'
                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <i className="fas fa-calendar-week text-[10px]" /> Weekly
              </button>
              <button
                onClick={() => setReportType('monthly')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                  reportType === 'monthly'
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/20'
                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <i className="fas fa-calendar-alt text-[10px]" /> Monthly
              </button>
            </div>

            {/* Date / Month Picker */}
            {reportType === 'monthly' ? (
              <div className="flex items-center gap-2">
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className={`border rounded-xl px-3.5 py-2 text-xs font-bold focus:outline-none cursor-pointer ${controlStyle}`}
                />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className={`border rounded-xl px-3.5 py-2 text-xs font-bold focus:outline-none cursor-pointer ${controlStyle}`}
                />
              </div>
            )}

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={setToday}
                className={`text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-xl border transition-all active:scale-95 ${
                  reportType === 'daily' && selectedDate === new Date().toISOString().split('T')[0]
                    ? 'bg-violet-600 text-white border-violet-500'
                    : isDark ? 'bg-[#181931] border-[#1b1c34] text-slate-300 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                Today
              </button>
              <button
                onClick={setYesterday}
                className={`text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-xl border transition-all active:scale-95 ${
                  isDark ? 'bg-[#181931] border-[#1b1c34] text-slate-300 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                Yesterday
              </button>
              <button
                onClick={setPast7Days}
                className={`text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-xl border transition-all active:scale-95 ${
                  reportType === 'weekly'
                    ? 'bg-indigo-600 text-white border-indigo-500'
                    : isDark ? 'bg-[#181931] border-[#1b1c34] text-slate-300 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                Past 7 Days
              </button>
              <button
                onClick={setThisMonth}
                className={`text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-xl border transition-all active:scale-95 ${
                  reportType === 'monthly' && selectedMonth === new Date().toISOString().substring(0, 7)
                    ? 'bg-violet-600 text-white border-violet-500'
                    : isDark ? 'bg-[#181931] border-[#1b1c34] text-slate-300 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                This Month
              </button>
              <button
                onClick={setLastMonth}
                className={`text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-xl border transition-all active:scale-95 ${
                  isDark ? 'bg-[#181931] border-[#1b1c34] text-slate-300 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                Last Month
              </button>
            </div>

            {/* Refresh Button */}
            <button
              onClick={fetchReports}
              disabled={loading}
              className={`text-[10px] font-bold uppercase tracking-wider px-3.5 py-2 rounded-xl border flex items-center gap-1.5 transition-all active:scale-95 ${
                isDark ? 'bg-[#181931] border-[#1b1c34] text-slate-300 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`} /> Sync
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-950/30 border border-red-900/40 rounded-2xl p-4 text-xs text-red-400 flex items-center gap-3">
          <i className="fas fa-exclamation-circle text-lg shrink-0" />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {/* 5 Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {/* Card 1: Total Deposits */}
        <div className={`border rounded-[1.8rem] p-6 shadow-md flex justify-between items-center ${cardStyle}`}>
          <div>
            <span className={`text-[10px] font-bold uppercase tracking-widest ${subtitleColor}`}>
              {reportType === 'daily' ? 'Daily Deposits' : reportType === 'weekly' ? 'Weekly Deposits' : 'Monthly Deposits'}
            </span>
            <h3 className="text-2xl font-black mt-2 leading-none text-emerald-500">
              {'\u20B9'}{formatCurrency(summary.totalDeposits)}
            </h3>
            <span className="text-[10px] text-slate-400 font-bold mt-2 flex items-center gap-1 leading-none">
              <i className="fas fa-check-circle text-emerald-400" /> {summary.depositCount} completed orders
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-lg shrink-0">
            <i className="fas fa-arrow-down" />
          </div>
        </div>

        {/* Card 2: Total Withdrawals */}
        <div className={`border rounded-[1.8rem] p-6 shadow-md flex justify-between items-center ${cardStyle}`}>
          <div>
            <span className={`text-[10px] font-bold uppercase tracking-widest ${subtitleColor}`}>
              {reportType === 'daily' ? 'Daily Withdrawals' : reportType === 'weekly' ? 'Weekly Withdrawals' : 'Monthly Withdrawals'}
            </span>
            <h3 className="text-2xl font-black mt-2 leading-none text-rose-500">
              {'\u20B9'}{formatCurrency(summary.totalWithdrawals)}
            </h3>
            <span className="text-[10px] text-slate-400 font-bold mt-2 flex items-center gap-1 leading-none">
              <i className="fas fa-arrow-up text-rose-400" /> {summary.withdrawalCount} payouts executed
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 text-lg shrink-0">
            <i className="fas fa-arrow-up" />
          </div>
        </div>

        {/* Card 3: Net Flow */}
        <div className={`border rounded-[1.8rem] p-6 shadow-md flex justify-between items-center ${cardStyle}`}>
          <div>
            <span className={`text-[10px] font-bold uppercase tracking-widest ${subtitleColor}`}>
              Net Platform Flow
            </span>
            <h3 className={`text-2xl font-black mt-2 leading-none ${summary.netCashflow >= 0 ? 'text-indigo-400' : 'text-amber-400'}`}>
              {'\u20B9'}{formatCurrency(summary.netCashflow)}
            </h3>
            <span className={`text-[10px] font-black mt-2 inline-flex items-center gap-1 leading-none px-2 py-0.5 rounded-full border ${
              summary.netCashflow >= 0
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}>
              {summary.netCashflow >= 0 ? '+ Inflow Positive' : '- Outflow Deficit'}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-lg shrink-0">
            <i className="fas fa-wallet" />
          </div>
        </div>

        {/* Card 4: Customer Retention & Recurring Deposits (NEW!) */}
        <div className={`border rounded-[1.8rem] p-6 shadow-md flex justify-between items-center ${cardStyle}`}>
          <div>
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] font-bold uppercase tracking-widest ${subtitleColor}`}>
                Recurring Deposits
              </span>
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-violet-600/10 text-violet-400 border border-violet-500/20">
                {summary.recurringDepositPct || 0}%
              </span>
            </div>
            <h3 className="text-2xl font-black mt-2 leading-none text-violet-400">
              {'\u20B9'}{formatCurrency(summary.recurringDeposits)}
            </h3>
            <span className="text-[10px] text-slate-400 font-bold mt-2 flex items-center gap-1 leading-none">
              <i className="fas fa-users text-violet-400" />
              {summary.uniqueRecurringUsers || 0} repeat users ({summary.retentionRate || 0}% retention)
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 text-lg shrink-0">
            <i className="fas fa-redo-alt" />
          </div>
        </div>

        {/* Card 5: New Registrations */}
        <div className={`border rounded-[1.8rem] p-6 shadow-md flex justify-between items-center ${cardStyle}`}>
          <div>
            <span className={`text-[10px] font-bold uppercase tracking-widest ${subtitleColor}`}>
              New Registrations
            </span>
            <h3 className={`text-2xl font-black mt-2 leading-none ${titleColor}`}>
              {summary.newUsersCount}
            </h3>
            <span className="text-[10px] text-indigo-400 font-bold mt-2 flex items-center gap-1 leading-none">
              <i className="fas fa-user-plus" /> registered accounts
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-lg shrink-0">
            <i className="fas fa-user-check" />
          </div>
        </div>
      </div>

      {/* MONTHLY & WEEKLY VIEW: Daily Breakdown Table */}
      {(reportType === 'monthly' || reportType === 'weekly') && (
        <div className={`border rounded-[1.8rem] overflow-hidden shadow-md ${cardStyle}`}>
          <div className={`p-6 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isDark ? 'border-[#1b1c34]/50' : 'border-slate-100'}`}>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold uppercase tracking-wide ${titleColor}`}>
                  {reportType === 'weekly'
                    ? `Weekly Breakdown (${reportData?.startDate || ''} to ${reportData?.endDate || ''})`
                    : `Daily Breakdown for ${selectedMonth}`}
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-600/10 text-indigo-400 border border-indigo-500/20">
                  {dailyBreakdown.length} Days Mapped
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                Day-by-day revenue, recurring deposit share, customer retention, and net cashflow
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs select-none">
              <thead>
                <tr className={`border-b font-black uppercase tracking-wider ${headerBg}`}>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Total Deposits</th>
                  <th className="px-6 py-4">Recurring Volume & Share</th>
                  <th className="px-6 py-4">Withdrawals Debited</th>
                  <th className="px-6 py-4">Net Cashflow</th>
                  <th className="px-6 py-4 text-center">Retention %</th>
                  <th className="px-6 py-4 text-center">New Users</th>
                  <th className="px-6 py-4 text-right">Drill Down</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-[#1b1c34]/40' : 'divide-slate-100'}`}>
                {dailyBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-12 text-slate-500 font-bold uppercase tracking-wider">
                      No records found for this period.
                    </td>
                  </tr>
                ) : (
                  dailyBreakdown.slice((breakdownPage - 1) * 10, breakdownPage * 10).map((row) => (
                    <tr key={row.date} className={`transition-colors ${isDark ? 'hover:bg-[#181931]/30' : 'hover:bg-slate-50'}`}>
                      <td className="px-6 py-4 font-mono font-bold">
                        <span className={titleColor}>{row.date}</span>
                        <span className="block text-[9px] text-slate-500 font-semibold uppercase mt-0.5">
                          {typeof row.day === 'number' ? `Day ${row.day}` : row.day}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-extrabold text-emerald-500 text-sm block">
                          {'\u20B9'}{formatCurrency(row.deposits)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
                          {row.depositCount} orders
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-extrabold text-violet-400 text-sm block">
                          {'\u20B9'}{formatCurrency(row.recurringDeposits)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
                          {row.recurringDepositPct || 0}% of deposits ({row.recurringDepositCount || 0} orders)
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-extrabold text-rose-500 text-sm block">
                          {'\u20B9'}{formatCurrency(row.withdrawals)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
                          {row.withdrawalCount} payouts
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold">
                        <span className={`text-sm ${row.netCashflow >= 0 ? 'text-indigo-400' : 'text-amber-400'}`}>
                          {'\u20B9'}{formatCurrency(row.netCashflow)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black border ${
                          (row.retentionRate || 0) >= 30
                            ? 'bg-violet-600/10 text-violet-400 border-violet-500/20'
                            : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                        }`}>
                          {row.retentionRate || 0}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-black border bg-indigo-600/10 text-indigo-400 border-indigo-500/20">
                          +{row.newUsers}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedDate(row.date);
                            setReportType('daily');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-[10px] uppercase tracking-wider active:scale-95 transition-all shadow-md shadow-violet-500/20"
                        >
                          View Day <i className="fas fa-chevron-right text-[8px] ml-1" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {/* Grand Total Footer */}
              {dailyBreakdown.length > 0 && (
                <tfoot>
                  <tr className={`border-t font-black uppercase text-xs ${isDark ? 'bg-[#181931] text-white border-[#1b1c34]' : 'bg-slate-100 text-slate-800 border-slate-200'}`}>
                    <td className="px-6 py-4">Total</td>
                    <td className="px-6 py-4 text-emerald-500">{'\u20B9'}{formatCurrency(summary.totalDeposits)} ({summary.depositCount})</td>
                    <td className="px-6 py-4 text-violet-400">{'\u20B9'}{formatCurrency(summary.recurringDeposits)} ({summary.recurringDepositPct || 0}%)</td>
                    <td className="px-6 py-4 text-rose-500">{'\u20B9'}{formatCurrency(summary.totalWithdrawals)} ({summary.withdrawalCount})</td>
                    <td className={`px-6 py-4 ${summary.netCashflow >= 0 ? 'text-indigo-400' : 'text-amber-400'}`}>{'\u20B9'}{formatCurrency(summary.netCashflow)}</td>
                    <td className="px-6 py-4 text-center text-violet-400">{summary.retentionRate || 0}% Ret.</td>
                    <td className="px-6 py-4 text-center">+{summary.newUsersCount} Users</td>
                    <td className="px-6 py-4"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Breakdown Pagination */}
          {Pagination && dailyBreakdown.length > 10 && (
            <Pagination
              currentPage={breakdownPage}
              totalItems={dailyBreakdown.length}
              pageSize={10}
              onPageChange={setBreakdownPage}
              theme={theme}
            />
          )}
        </div>
      )}

      {/* DAILY VIEW: Drilldown Tabs & Tables */}
      {reportType === 'daily' && (
        <div className={`border rounded-[1.8rem] overflow-hidden shadow-md ${cardStyle}`}>
          {/* Subtab Switcher */}
          <div className={`p-6 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isDark ? 'border-[#1b1c34]/50' : 'border-slate-100'}`}>
            <div>
              <span className={`text-sm font-bold uppercase tracking-wide ${titleColor}`}>
                Daily Activity Log: {selectedDate}
              </span>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                Detailed transaction records, customer deposit sequence, and member signups
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setDailyTab('deposits')}
                className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all ${
                  dailyTab === 'deposits'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                    : isDark ? 'bg-[#181931] text-slate-400 hover:text-white border border-[#1b1c34]' : 'bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
              >
                <i className="fas fa-arrow-down" /> Deposits ({drilldown.deposits.length})
              </button>
              <button
                onClick={() => setDailyTab('withdrawals')}
                className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all ${
                  dailyTab === 'withdrawals'
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-500/20'
                    : isDark ? 'bg-[#181931] text-slate-400 hover:text-white border border-[#1b1c34]' : 'bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
              >
                <i className="fas fa-arrow-up" /> Withdrawals ({drilldown.withdrawals.length})
              </button>
              <button
                onClick={() => setDailyTab('newUsers')}
                className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all ${
                  dailyTab === 'newUsers'
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20'
                    : isDark ? 'bg-[#181931] text-slate-400 hover:text-white border border-[#1b1c34]' : 'bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
              >
                <i className="fas fa-users" /> New Users ({drilldown.newUsers.length})
              </button>
            </div>
          </div>

          {/* Subtab 1: Deposits Table with Retention / Repeat Customer Filters */}
          {dailyTab === 'deposits' && (
            <>
              {/* Deposit Sub-Filters: All | First-Time (FTD) | Recurring */}
              <div className={`px-6 py-3 border-b flex items-center gap-2 flex-wrap text-xs ${isDark ? 'border-[#1b1c34]/40 bg-[#101124]/40' : 'border-slate-100 bg-slate-50/50'}`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${subtitleColor} mr-1`}>
                  Customer Type:
                </span>
                <button
                  onClick={() => { setDepositFilter('all'); setDepPage(1); }}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    depositFilter === 'all'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Deposits ({drilldown.deposits.length})
                </button>
                <button
                  onClick={() => { setDepositFilter('ftd'); setDepPage(1); }}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${
                    depositFilter === 'ftd'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <i className="fas fa-star text-[9px]" />
                  First-Time FTD ({summary.ftdDepositCount || 0} - {'\u20B9'}{formatCurrency(summary.ftdDeposits || 0)})
                </button>
                <button
                  onClick={() => { setDepositFilter('recurring'); setDepPage(1); }}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${
                    depositFilter === 'recurring'
                      ? 'bg-violet-600 text-white shadow-sm'
                      : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <i className="fas fa-redo-alt text-[9px]" />
                  Recurring / Repeat ({summary.recurringDepositCount || 0} - {'\u20B9'}{formatCurrency(summary.recurringDeposits || 0)})
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs select-none">
                  <thead>
                    <tr className={`border-b font-black uppercase tracking-wider ${headerBg}`}>
                      <th className="px-6 py-4">Time</th>
                      <th className="px-6 py-4">Order ID</th>
                      <th className="px-6 py-4">Customer Details</th>
                      <th className="px-6 py-4 text-center">Deposit Stage</th>
                      <th className="px-6 py-4">Reference / UTR</th>
                      <th className="px-6 py-4">Amount</th>
                      <th className="px-6 py-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-[#1b1c34]/40' : 'divide-slate-100'}`}>
                    {filteredDeposits.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center py-12 text-slate-500 font-bold uppercase tracking-wider">
                          No matching deposits recorded on this date.
                        </td>
                      </tr>
                    ) : (
                      filteredDeposits.slice((depPage - 1) * 10, depPage * 10).map((dep) => (
                        <tr key={dep.id || dep.order_id} className={`transition-colors ${isDark ? 'hover:bg-[#181931]/30' : 'hover:bg-slate-50'}`}>
                          <td className="px-6 py-4 text-slate-400 font-mono text-[11px]">
                            {new Date(dep.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-6 py-4 font-mono font-bold text-[11px] text-slate-300">
                            {dep.order_id}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`font-bold block ${titleColor}`}>{dep.user_mobile}</span>
                            <span className="text-[10px] text-slate-500 font-mono block">UID: {dep.user_uid}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {dep.is_recurring ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border bg-violet-600/10 text-violet-400 border-violet-500/20">
                                <i className="fas fa-redo-alt text-[8px]" />
                                Repeat #{dep.deposit_sequence} ({dep.user_total_deposits} Total)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border bg-blue-500/10 text-blue-400 border-blue-500/20">
                                <i className="fas fa-star text-[8px]" />
                                1st Deposit (FTD)
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 font-mono text-violet-400 font-bold">
                            {dep.utr}
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-extrabold text-emerald-500 text-sm">
                              {'\u20B9'}{formatCurrency(dep.amount)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                              {dep.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {Pagination && filteredDeposits.length > 10 && (
                <Pagination
                  currentPage={depPage}
                  totalItems={filteredDeposits.length}
                  pageSize={10}
                  onPageChange={setDepPage}
                  theme={theme}
                />
              )}
            </>
          )}

          {/* Subtab 2: Withdrawals Table */}
          {dailyTab === 'withdrawals' && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs select-none">
                  <thead>
                    <tr className={`border-b font-black uppercase tracking-wider ${headerBg}`}>
                      <th className="px-6 py-4">Time</th>
                      <th className="px-6 py-4">User Details</th>
                      <th className="px-6 py-4">Description / Bank Details</th>
                      <th className="px-6 py-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-[#1b1c34]/40' : 'divide-slate-100'}`}>
                    {drilldown.withdrawals.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="text-center py-12 text-slate-500 font-bold uppercase tracking-wider">
                          No withdrawals recorded on this date.
                        </td>
                      </tr>
                    ) : (
                      drilldown.withdrawals.slice((withPage - 1) * 10, withPage * 10).map((w) => (
                        <tr key={w.id} className={`transition-colors ${isDark ? 'hover:bg-[#181931]/30' : 'hover:bg-slate-50'}`}>
                          <td className="px-6 py-4 text-slate-400 font-mono text-[11px]">
                            {new Date(w.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`font-bold block ${titleColor}`}>{w.user_mobile}</span>
                            <span className="text-[10px] text-slate-500 font-mono block">UID: {w.user_uid}</span>
                          </td>
                          <td className="px-6 py-4 text-slate-300 font-semibold text-[11px]">
                            {w.description}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="font-extrabold text-rose-500 text-sm">
                              {'\u20B9'}{formatCurrency(w.amount)}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {Pagination && drilldown.withdrawals.length > 10 && (
                <Pagination
                  currentPage={withPage}
                  totalItems={drilldown.withdrawals.length}
                  pageSize={10}
                  onPageChange={setWithPage}
                  theme={theme}
                />
              )}
            </>
          )}

          {/* Subtab 3: New Users Table */}
          {dailyTab === 'newUsers' && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs select-none">
                  <thead>
                    <tr className={`border-b font-black uppercase tracking-wider ${headerBg}`}>
                      <th className="px-6 py-4">Registered Time</th>
                      <th className="px-6 py-4">User UID</th>
                      <th className="px-6 py-4">Mobile Number</th>
                      <th className="px-6 py-4">Username</th>
                      <th className="px-6 py-4">Wallet Balance</th>
                      <th className="px-6 py-4 text-right">T Coin</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-[#1b1c34]/40' : 'divide-slate-100'}`}>
                    {drilldown.newUsers.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center py-12 text-slate-500 font-bold uppercase tracking-wider">
                          No new users registered on this date.
                        </td>
                      </tr>
                    ) : (
                      drilldown.newUsers.slice((userPage - 1) * 10, userPage * 10).map((u) => (
                        <tr key={u.id} className={`transition-colors ${isDark ? 'hover:bg-[#181931]/30' : 'hover:bg-slate-50'}`}>
                          <td className="px-6 py-4 text-slate-400 font-mono text-[11px]">
                            {new Date(u.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-6 py-4 font-mono font-bold text-indigo-400">
                            {u.uid}
                          </td>
                          <td className="px-6 py-4 font-bold">
                            <span className={titleColor}>{u.mobile}</span>
                          </td>
                          <td className="px-6 py-4 text-slate-400">
                            {u.username}
                          </td>
                          <td className="px-6 py-4 font-extrabold text-emerald-500">
                            <span>{'\u20B9'}{formatCurrency(u.inr_balance)}</span>
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-amber-500">
                            {formatCurrency(u.bcoin_balance)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {Pagination && drilldown.newUsers.length > 10 && (
                <Pagination
                  currentPage={userPage}
                  totalItems={drilldown.newUsers.length}
                  pageSize={10}
                  onPageChange={setUserPage}
                  theme={theme}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ReportsManager;
