import React, { useState } from 'react';
import {
  PieChart,
  Plus,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Edit2,
  Trash2,
  DollarSign
} from 'lucide-react';
import { AppState, BudgetItem } from '../types';

interface BudgetsViewProps {
  state: AppState;
  onUpdateBudgets: (budgets: BudgetItem[]) => Promise<void>;
}

export const BudgetsView: React.FC<BudgetsViewProps> = ({ state, onUpdateBudgets }) => {
  const { transactions, settings } = state;
  const { budgets = [], categories } = settings;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetItem | null>(null);
  const [category, setCategory] = useState(categories[0] || 'Groceries');
  const [limit, setLimit] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Current month transactions
  const currentMonthKey = new Date().toISOString().slice(0, 7); // YYYY-MM
  const monthExpenseTxs = transactions.filter(
    (t) => t.type === 'expense' && t.date.startsWith(currentMonthKey)
  );

  // Category spending mapping
  const spentByCat: Record<string, number> = {};
  for (const t of monthExpenseTxs) {
    spentByCat[t.category] = (spentByCat[t.category] || 0) + t.amount;
  }

  // Budget summaries
  const totalBudgetLimit = budgets.reduce((sum, b) => sum + (b.active ? b.limit : 0), 0);
  const totalBudgetSpent = budgets.reduce(
    (sum, b) => sum + (b.active ? spentByCat[b.category] || 0 : 0),
    0
  );
  const overallRemaining = Math.max(0, totalBudgetLimit - totalBudgetSpent);
  const overallPercentage = totalBudgetLimit > 0 ? (totalBudgetSpent / totalBudgetLimit) * 100 : 0;
  const overBudgetCount = budgets.filter((b) => (spentByCat[b.category] || 0) > b.limit).length;

  const handleOpenAdd = () => {
    setEditingBudget(null);
    setCategory(categories[0] || 'Groceries');
    setLimit('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (b: BudgetItem) => {
    setEditingBudget(b);
    setCategory(b.category);
    setLimit(b.limit.toString());
    setIsModalOpen(true);
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(Number(limit)) || Number(limit) <= 0) return;

    setIsSaving(true);
    try {
      const parsedLimit = Math.abs(Number(limit));
      let updated: BudgetItem[];
      if (editingBudget) {
        updated = budgets.map((b) =>
          b.category === editingBudget.category
            ? { ...b, category, limit: parsedLimit, active: true }
            : b
        );
      } else {
        // Prevent duplicate category budget
        const exists = budgets.find((b) => b.category.toLowerCase() === category.toLowerCase());
        if (exists) {
          updated = budgets.map((b) =>
            b.category.toLowerCase() === category.toLowerCase()
              ? { ...b, limit: parsedLimit, active: true }
              : b
          );
        } else {
          updated = [...budgets, { id: crypto.randomUUID(), category, limit: parsedLimit, active: true }];
        }
      }
      await onUpdateBudgets(updated);
      setIsModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (cat: string) => {
    if (!window.confirm(`Delete budget for ${cat}?`)) return;
    const updated = budgets.filter((b) => b.category !== cat);
    await onUpdateBudgets(updated);
  };

  return (
    <div id="budgets-view" className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Monthly Budgets</h2>
          <p className="text-sm text-slate-500">
            Set spending targets and monitor limits for {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
          </p>
        </div>

        <button
          id="create-budget-btn"
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#6558D3] hover:bg-[#574abf] text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Create budget
        </button>
      </div>

      {/* Budget Health Overview Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Monthly Budget Health
            </span>
            <div className="text-3xl font-bold tracking-tight text-slate-900">
              ${totalBudgetSpent.toFixed(2)}{' '}
              <span className="text-slate-400 text-lg font-normal">/ ${totalBudgetLimit.toFixed(2)}</span>
            </div>
            <p className="text-xs text-slate-500">
              {totalBudgetLimit > 0
                ? `${overallPercentage.toFixed(1)}% of total planned budget used this month`
                : 'No active monthly budgets configured'}
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center min-w-[110px]">
              <div className="text-slate-400 text-[11px]">Remaining</div>
              <div className="text-base font-bold text-emerald-600">${overallRemaining.toFixed(2)}</div>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center min-w-[110px]">
              <div className="text-slate-400 text-[11px]">Over Budget</div>
              <div className={`text-base font-bold ${overBudgetCount > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                {overBudgetCount} {overBudgetCount === 1 ? 'category' : 'categories'}
              </div>
            </div>
          </div>
        </div>

        {totalBudgetLimit > 0 && (
          <div className="mt-5">
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
              <div
                style={{ width: `${Math.min(100, overallPercentage)}%` }}
                className={`h-full rounded-full transition-all ${
                  overallPercentage > 100 ? 'bg-rose-500' : overallPercentage > 80 ? 'bg-amber-500' : 'bg-[#6558D3]'
                }`}
              />
            </div>
          </div>
        )}
      </div>

      {/* Budget Cards Grid */}
      {budgets.length === 0 ? (
        <div className="bg-white border border-slate-200/90 rounded-2xl py-16 px-4 text-center shadow-2xs">
          <PieChart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-700">No category budgets yet</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Create monthly spending limits for categories like Groceries, Dining, or Utilities to stay on track.
          </p>
          <button
            onClick={handleOpenAdd}
            className="mt-4 px-4 py-2 bg-[#6558D3] hover:bg-[#574abf] text-white text-xs font-semibold rounded-xl shadow-xs"
          >
            Create your first budget
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {budgets.map((b) => {
            const spent = spentByCat[b.category] || 0;
            const remaining = b.limit - spent;
            const pct = b.limit > 0 ? (spent / b.limit) * 100 : 0;
            const isOver = spent > b.limit;

            return (
              <div
                key={b.category}
                className={`bg-white border rounded-2xl p-5 shadow-2xs flex flex-col justify-between ${
                  isOver ? 'border-rose-200 ring-1 ring-rose-200' : 'border-slate-200/90'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-base">{b.category}</h4>
                      <span className="text-xs text-slate-400">Monthly Target</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(b)}
                        className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100"
                        title="Edit budget"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(b.category)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50"
                        title="Delete budget"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="my-4">
                    <div className="flex items-baseline justify-between">
                      <div className="text-2xl font-bold text-slate-900">${spent.toFixed(2)}</div>
                      <div className="text-xs text-slate-500">of ${b.limit.toFixed(2)}</div>
                    </div>

                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2">
                      <div
                        style={{ width: `${Math.min(100, pct)}%` }}
                        className={`h-full rounded-full ${
                          isOver ? 'bg-rose-500' : pct > 85 ? 'bg-amber-500' : 'bg-[#6558D3]'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  {isOver ? (
                    <span className="text-rose-600 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Over by ${Math.abs(remaining).toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-emerald-600 font-medium">
                      ${remaining.toFixed(2)} remaining
                    </span>
                  )}
                  <span className="text-slate-400 font-medium">{pct.toFixed(0)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Budget Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="font-bold text-slate-900 text-base mb-4">
              {editingBudget ? `Edit ${editingBudget.category} Budget` : 'Create Category Budget'}
            </h3>

            <form onSubmit={handleSaveModal} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Category</label>
                <select
                  value={category}
                  disabled={Boolean(editingBudget)}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3] disabled:bg-slate-100"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Monthly Limit ($)
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  required
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-[#6558D3] hover:bg-[#574abf] text-white text-xs font-semibold rounded-xl shadow-xs"
                >
                  {isSaving ? 'Saving...' : 'Save Budget'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
