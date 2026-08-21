import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  PiggyBank,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  AlertCircle,
  Calendar,
  Layers,
  Sparkles,
  Receipt,
  Plus
} from 'lucide-react';
import { AppState, DatePeriod, Transaction } from '../types';
import { PeriodSelector, filterTransactionsByPeriod } from './PeriodSelector';
import { NavTab } from './Sidebar';

interface DashboardViewProps {
  state: AppState;
  onSelectPeriod: (period: DatePeriod) => void;
  onNavigateTab?: (tab: NavTab) => void;
  onSelectTab?: (tab: NavTab) => void;
  onOpenAddEntry: () => void;
  onOpenImport: () => void;
  onOpenDriveSync?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  state,
  onSelectPeriod,
  onNavigateTab,
  onSelectTab,
  onOpenAddEntry,
  onOpenImport,
  onOpenDriveSync
}) => {
  const navigate = onSelectTab || onNavigateTab || (() => {});
  const { transactions, settings } = state;

  const { selectedPeriod, assets, liabilities, netWorthConfigured, subscriptions, recurring } = settings;

  // Filtered transactions for current period
  const filteredTxs = filterTransactionsByPeriod(transactions, selectedPeriod);

  // Income & Spending calculations
  const totalIncome = filteredTxs
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalSpending = filteredTxs
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const savingsRate = totalIncome > 0 ? Math.max(0, ((totalIncome - totalSpending) / totalIncome) * 100) : 0;
  const netSavings = totalIncome - totalSpending;

  // Net Worth calculation
  const netWorthValue = (assets || 0) - (liabilities || 0);

  // Needs review count
  const needsReviewCount = transactions.filter((t) => t.category === 'Needs review').length;

  // Spending by Category
  const expenseTxs = filteredTxs.filter((t) => t.type === 'expense');
  const catMap: Record<string, number> = {};
  for (const t of expenseTxs) {
    const cat = t.category || 'Other';
    catMap[cat] = (catMap[cat] || 0) + t.amount;
  }
  const categoryBreakdown = Object.entries(catMap)
    .map(([cat, amount]) => ({
      category: cat,
      amount,
      percentage: totalSpending > 0 ? (amount / totalSpending) * 100 : 0
    }))
    .sort((a, b) => b.amount - a.amount);

  // Cash flow by month (up to 7 months)
  const monthlyData: Record<string, { month: string; income: number; expense: number }> = {};
  for (const t of transactions) {
    const monthKey = t.date.slice(0, 7); // YYYY-MM
    if (!monthlyData[monthKey]) {
      const [y, m] = monthKey.split('-');
      const monthName = new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleString('default', {
        month: 'short'
      });
      monthlyData[monthKey] = { month: `${monthName} '${y.slice(2)}`, income: 0, expense: 0 };
    }
    if (t.type === 'income') {
      monthlyData[monthKey].income += t.amount;
    } else {
      monthlyData[monthKey].expense += t.amount;
    }
  }

  const sortedMonths = Object.keys(monthlyData)
    .sort()
    .slice(-7)
    .map((k) => monthlyData[k]);

  // Recent 5 transactions in selected period
  const recentTxs = [...filteredTxs].slice(0, 5);

  // Coming up items (confirmed recurring + subscriptions)
  const upcomingItems = [
    ...subscriptions.map((s) => ({
      name: s.name,
      amount: s.amount,
      date: s.nextRenewal,
      type: 'Subscription',
      cadence: s.cadence
    })),
    ...recurring.map((r) => ({
      name: r.name,
      amount: r.amount,
      date: r.nextDate,
      type: 'Recurring bill',
      cadence: r.cadence
    }))
  ]
    .filter((item) => item.date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  return (
    <div id="dashboard-view" className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Period Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Financial Overview</h2>
          <p className="text-sm text-slate-500">
            Real-time financial summary calculated from your D1 ledger
          </p>
        </div>

        <PeriodSelector selectedPeriod={selectedPeriod} onSelectPeriod={onSelectPeriod} />
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Net Worth */}
        <div
          id="card-net-worth"
          className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Net Worth
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
              <Wallet className="w-4 h-4" />
            </div>
          </div>

          <div className="my-3">
            {netWorthConfigured ? (
              <div className={`text-2xl font-bold tracking-tight ${netWorthValue >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                ${netWorthValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            ) : (
              <div>
                <div className="text-2xl font-bold text-slate-400">Not set</div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set assets &amp; liabilities in Settings
                </p>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            {netWorthConfigured ? (
              <span>Assets ${assets.toLocaleString()} &bull; Liab ${liabilities.toLocaleString()}</span>
            ) : (
              <button
                id="networth-configure-btn"
                onClick={() => navigate('settings')}
                className="text-[#6558D3] hover:underline font-medium flex items-center gap-1"
              >
                Configure in Settings <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* 2. Income */}
        <div
          id="card-income"
          className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Income
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>

          <div className="my-3">
            <div className="text-2xl font-bold tracking-tight text-emerald-600">
              ${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>{filteredTxs.filter((t) => t.type === 'income').length} income records</span>
            <span className="text-slate-400">Selected period</span>
          </div>
        </div>

        {/* 3. Spending */}
        <div
          id="card-spending"
          className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Spending
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>

          <div className="my-3">
            <div className="text-2xl font-bold tracking-tight text-slate-900">
              ${totalSpending.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>{filteredTxs.filter((t) => t.type === 'expense').length} expense records</span>
            <span className="text-slate-400">Selected period</span>
          </div>
        </div>

        {/* 4. Savings Rate */}
        <div
          id="card-savings-rate"
          className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Savings Rate
            </span>
            <div className="w-8 h-8 rounded-xl bg-violet-50 text-[#6558D3] flex items-center justify-center">
              <PiggyBank className="w-4 h-4" />
            </div>
          </div>

          <div className="my-3">
            <div className="text-2xl font-bold tracking-tight text-[#6558D3]">
              {savingsRate.toFixed(1)}%
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>
              Net: {netSavings >= 0 ? '+' : '-'}${Math.abs(netSavings).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-slate-400">
              {totalIncome > 0 ? `${savingsRate.toFixed(0)}% retained` : 'No income'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cash Flow Chart (2 columns) */}
        <div
          id="section-cashflow-chart"
          className="lg:col-span-2 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Cash Flow History</h3>
              <p className="text-xs text-slate-500">Monthly income vs expenses</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Income
              </span>
              <span className="flex items-center gap-1 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Expenses
              </span>
            </div>
          </div>

          {sortedMonths.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <Layers className="w-10 h-10 text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-700">Import or add transactions to see cash flow.</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                As you log earnings and expenses, your monthly cash flow trajectories will appear here.
              </p>
              <button
                onClick={onOpenImport}
                className="mt-3 px-3.5 py-1.5 bg-[#6558D3] text-white text-xs font-semibold rounded-xl hover:bg-[#574abf] transition-colors"
              >
                Import statement
              </button>
            </div>
          ) : (
            <div className="h-64 flex flex-col justify-end pt-4">
              <div className="flex items-end justify-between gap-3 h-48 border-b border-slate-200 pb-2">
                {sortedMonths.map((m, idx) => {
                  const maxVal = Math.max(
                    ...sortedMonths.map((x) => Math.max(x.income, x.expense)),
                    100
                  );
                  const incHeight = Math.max(4, (m.income / maxVal) * 160);
                  const expHeight = Math.max(4, (m.expense / maxVal) * 160);

                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div className="w-full flex items-end justify-center gap-1">
                        <div
                          style={{ height: `${incHeight}px` }}
                          className="w-1/2 max-w-[20px] bg-emerald-500 rounded-t-sm transition-all hover:bg-emerald-600"
                          title={`Income: $${m.income.toFixed(2)}`}
                        />
                        <div
                          style={{ height: `${expHeight}px` }}
                          className="w-1/2 max-w-[20px] bg-amber-500 rounded-t-sm transition-all hover:bg-amber-600"
                          title={`Expenses: $${m.expense.toFixed(2)}`}
                        />
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium truncate w-full text-center">
                        {m.month}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Spending by Category (1 column) */}
        <div
          id="section-category-breakdown"
          className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs flex flex-col justify-between"
        >
          <div>
            <h3 className="font-bold text-slate-900 text-base">Spending by Category</h3>
            <p className="text-xs text-slate-500 mb-4">Breakdown for {selectedPeriod.replace('-', ' ')}</p>

            {categoryBreakdown.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-center p-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <PiggyBank className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-xs font-medium text-slate-600">No expense records in this period</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {categoryBreakdown.slice(0, 6).map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 truncate max-w-[120px]">
                        {item.category}
                      </span>
                      <span className="font-semibold text-slate-900">
                        ${item.amount.toFixed(2)}{' '}
                        <span className="text-slate-400 font-normal">({item.percentage.toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${Math.min(100, item.percentage)}%` }}
                        className="bg-[#6558D3] h-full rounded-full"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Total: ${totalSpending.toFixed(2)}</span>
            <button
              onClick={() => navigate('transactions')}
              className="text-[#6558D3] hover:underline font-medium flex items-center gap-0.5"
            >
              View all <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Row: Recent Activity & Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity (2 columns) */}
        <div
          id="section-recent-activity"
          className="lg:col-span-2 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Recent Activity</h3>
              <p className="text-xs text-slate-500">Latest entries in selected period</p>
            </div>
            <button
              id="dash-add-entry-btn"
              onClick={onOpenAddEntry}
              className="text-xs font-semibold text-[#6558D3] hover:text-[#574abf] flex items-center gap-1 bg-violet-50 hover:bg-violet-100/80 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add entry
            </button>
          </div>

          {recentTxs.length === 0 ? (
            <div className="py-10 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-700">No transactions recorded yet</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Use Add Entry or Import to log your first transaction
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentTxs.map((t) => {
                const isIncome = t.type === 'income';
                return (
                  <div key={t.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isIncome ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {isIncome ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="font-medium text-sm text-slate-900 truncate max-w-[200px] md:max-w-xs">
                          {t.merchant}
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-2">
                          <span>{t.date}</span>
                          <span>&bull;</span>
                          <span>{t.category}</span>
                          {t.receipt && (
                            <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.2 rounded font-medium">
                              Receipt
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`font-semibold text-sm whitespace-nowrap ${
                        isIncome ? 'text-emerald-600' : 'text-slate-900'
                      }`}
                    >
                      {isIncome ? '+' : '-'}${t.amount.toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Ledgerly Insights & Coming Up */}
        <div className="space-y-6">
          {/* Ledgerly Insights */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-xs border border-slate-800">
            <div className="flex items-center gap-2 text-violet-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <Sparkles className="w-4 h-4 text-violet-400" />
              Ledgerly Insight
            </div>
            {needsReviewCount > 0 ? (
              <div>
                <p className="text-sm text-slate-200">
                  You have <span className="font-bold text-amber-300">{needsReviewCount}</span> transactions
                  marked as <span className="underline">Needs review</span>.
                </p>
                <button
                  onClick={() => navigate('transactions')}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-violet-300 hover:text-white cursor-pointer"
                >
                  Review categories <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-300 leading-relaxed">
                All saved transactions are categorized. Connect your Google Drive inbox for automated daily intake.
              </p>
            )}
          </div>

          {/* Coming Up */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-slate-900 text-sm">Coming Up</h4>
              <button
                onClick={() => navigate('recurring')}
                className="text-xs text-[#6558D3] font-semibold hover:underline cursor-pointer"
              >
                Manage
              </button>
            </div>

            {upcomingItems.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-500">
                <p>No recurring bills or subscriptions scheduled.</p>
                <button
                  onClick={() => navigate('recurring')}
                  className="mt-1.5 text-[#6558D3] hover:underline font-medium inline-block cursor-pointer"
                >
                  Add recurring payment
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 text-xs">
                    <div>
                      <div className="font-medium text-slate-800">{item.name}</div>
                      <div className="text-[10px] text-slate-400">Due {item.date} ({item.cadence})</div>
                    </div>
                    <div className="font-semibold text-slate-900">${item.amount.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
