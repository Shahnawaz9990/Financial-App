import React, { useState } from 'react';
import {
  Repeat,
  Sparkles,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  Calendar,
  DollarSign,
  AlertCircle,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { AppState, RecurringPaymentItem, Cadence, DetectedPattern } from '../types';
import { detectPatterns } from '../lib/detection';

interface RecurringViewProps {
  state: AppState;
  onUpdateRecurring: (items: RecurringPaymentItem[]) => Promise<void>;
  onDismissPattern: (key: string) => Promise<void>;
}

export const RecurringView: React.FC<RecurringViewProps> = ({
  state,
  onUpdateRecurring,
  onDismissPattern
}) => {
  const { transactions, settings } = state;
  const { recurring = [], subscriptions = [], dismissedPatterns = [], categories, accounts } = settings;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RecurringPaymentItem | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState(categories[0] || 'Utilities');
  const [amount, setAmount] = useState('');
  const [cadence, setCadence] = useState<Cadence>('monthly');
  const [nextDate, setNextDate] = useState(new Date().toISOString().split('T')[0]);
  const [account, setAccount] = useState(accounts[0] || 'Main Checking');
  const [isSaving, setIsSaving] = useState(false);

  // Run automatic detection
  const detected = detectPatterns(
    transactions,
    dismissedPatterns,
    subscriptions.map((s) => s.name),
    recurring.map((r) => r.name)
  );
  const recurringSuggestions = detected.recurring;

  // Calculate commitments (confirmed + suggestions without double counting)
  const calcMonthly = (amt: number, cad: Cadence) => {
    if (cad === 'weekly') return (amt * 52) / 12;
    if (cad === 'biweekly') return (amt * 26) / 12;
    if (cad === 'monthly') return amt;
    if (cad === 'quarterly') return amt / 3;
    if (cad === 'annual') return amt / 12;
    return amt;
  };

  const confirmedMonthly = recurring.reduce((sum, r) => sum + calcMonthly(r.amount, r.cadence), 0);
  const suggestionsMonthly = recurringSuggestions.reduce((sum, s) => sum + s.monthlyEquivalent, 0);
  const totalMonthlyCommitment = confirmedMonthly + suggestionsMonthly;
  const totalAnnualCommitment = totalMonthlyCommitment * 12;

  // Next expected date among confirmed
  const sortedDates = [...recurring]
    .filter((r) => r.nextDate)
    .sort((a, b) => a.nextDate.localeCompare(b.nextDate));
  const nextPayment = sortedDates[0];

  const handleOpenAdd = () => {
    setEditingItem(null);
    setName('');
    setCategory(categories[0] || 'Utilities');
    setAmount('');
    setCadence('monthly');
    setNextDate(new Date().toISOString().split('T')[0]);
    setAccount(accounts[0] || 'Main Checking');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: RecurringPaymentItem) => {
    setEditingItem(item);
    setName(item.name);
    setCategory(item.category);
    setAmount(item.amount.toString());
    setCadence(item.cadence);
    setNextDate(item.nextDate);
    setAccount(item.account || accounts[0] || 'Main Checking');
    setIsModalOpen(true);
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isNaN(Number(amount)) || Number(amount) <= 0) return;

    setIsSaving(true);
    try {
      const parsedAmount = Math.abs(Number(amount));
      let updated: RecurringPaymentItem[];
      if (editingItem) {
        updated = recurring.map((r) =>
          r.id === editingItem.id
            ? { ...r, name: name.trim(), category, amount: parsedAmount, cadence, nextDate, account }
            : r
        );
      } else {
        const newItem: RecurringPaymentItem = {
          id: crypto.randomUUID(),
          name: name.trim(),
          category,
          amount: parsedAmount,
          cadence,
          nextDate,
          account,
          active: true
        };
        updated = [...recurring, newItem];
      }
      await onUpdateRecurring(updated);
      setIsModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this recurring payment?')) return;
    const updated = recurring.filter((r) => r.id !== id);
    await onUpdateRecurring(updated);
  };

  const handleKeepSuggestion = async (sug: DetectedPattern) => {
    const newItem: RecurringPaymentItem = {
      id: crypto.randomUUID(),
      name: sug.originalMerchant,
      category: sug.category,
      amount: sug.averageAmount,
      cadence: sug.cadence,
      nextDate: sug.nextDate,
      account: sug.account || 'Imported account',
      active: true
    };
    await onUpdateRecurring([...recurring, newItem]);
  };

  const handleIgnoreSuggestion = async (key: string) => {
    await onDismissPattern(key);
  };

  return (
    <div id="recurring-view" className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Recurring Payments</h2>
          <p className="text-sm text-slate-500">
            Track utilities, rent, loans, and repeating bills detected from real transactions
          </p>
        </div>

        <button
          id="add-recurring-btn"
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#6558D3] hover:bg-[#574abf] text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Add recurring payment
        </button>
      </div>

      {/* Active Detection Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 md:p-5 flex items-center justify-between gap-4 border border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-600/30 border border-violet-500/40 flex items-center justify-center text-violet-300 shrink-0">
            <Sparkles className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <div className="font-semibold text-sm flex items-center gap-2">
              <span>Cadence-Aware Recurring Detection</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
                Active
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Continuously scans for repeating 5-9d, 12-17d, 24-40d, and annual intervals with low amount jitter.
            </p>
          </div>
        </div>
        <div className="hidden md:block text-right text-xs text-slate-400">
          <div>{recurringSuggestions.length} detected</div>
          <div>{recurring.length} confirmed</div>
        </div>
      </div>

      {/* 3 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Monthly Commitment
          </span>
          <div className="text-2xl font-bold tracking-tight text-slate-900 mt-2">
            ${totalMonthlyCommitment.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            ${confirmedMonthly.toFixed(2)} confirmed &bull; ${suggestionsMonthly.toFixed(2)} detected
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Annual Commitment
          </span>
          <div className="text-2xl font-bold tracking-tight text-slate-900 mt-2">
            ${totalAnnualCommitment.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-400 mt-1">Projected 12-month total</div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Next Expected Payment
          </span>
          <div className="text-2xl font-bold tracking-tight text-[#6558D3] mt-2">
            {nextPayment ? `$${nextPayment.amount.toFixed(2)}` : 'None'}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {nextPayment ? `${nextPayment.name} (${nextPayment.nextDate})` : 'No upcoming bills'}
          </div>
        </div>
      </div>

      {/* Detected Suggestions Section */}
      {recurringSuggestions.length > 0 && (
        <div className="bg-violet-50/70 border border-violet-200/80 rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-[#6558D3]" />
            <h3 className="font-bold text-slate-900 text-sm">
              Detected Recurring Patterns ({recurringSuggestions.length})
            </h3>
          </div>
          <p className="text-xs text-slate-600 mb-4">
            The detection engine found repeating charges that match recurring cadences. Choose Keep to confirm or Ignore to dismiss.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recurringSuggestions.map((sug) => (
              <div
                key={sug.key}
                className="bg-white border border-violet-100 rounded-xl p-4 flex flex-col justify-between shadow-2xs"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{sug.originalMerchant}</div>
                      <div className="text-xs text-slate-500">
                        {sug.category} &bull; {sug.cadence} ({sug.occurrences} transactions)
                      </div>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                        sug.confidence === 'high'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {sug.confidence === 'high' ? 'High confidence' : 'Likely'}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                    <span className="text-slate-500">Avg: ${sug.averageAmount.toFixed(2)}</span>
                    <span className="font-semibold text-slate-900">
                      ~${sug.monthlyEquivalent.toFixed(2)}/mo
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 pt-2">
                  <button
                    onClick={() => handleKeepSuggestion(sug)}
                    className="flex-1 px-3 py-1.5 bg-[#6558D3] hover:bg-[#574abf] text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Keep
                  </button>
                  <button
                    onClick={() => handleIgnoreSuggestion(sug.key)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium rounded-lg flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Ignore
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirmed Recurring List */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-base">Confirmed Recurring Payments</h3>
          <span className="text-xs text-slate-500">{recurring.length} items</span>
        </div>

        {recurring.length === 0 ? (
          <div className="py-14 px-4 text-center bg-slate-50/50">
            <Repeat className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-slate-700">No recurring bills added yet</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Add your recurring bills manually or import transactions to let Ledgerly discover them automatically.
            </p>
            <button
              onClick={handleOpenAdd}
              className="mt-4 px-4 py-2 bg-[#6558D3] hover:bg-[#574abf] text-white text-xs font-semibold rounded-xl"
            >
              Add recurring payment
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recurring.map((item) => (
              <div key={item.id} className="p-4 md:px-6 flex items-center justify-between gap-4 hover:bg-slate-50/60">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-violet-50 text-[#6558D3] flex items-center justify-center font-bold">
                    <Repeat className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-900 text-sm">{item.name}</div>
                    <div className="text-xs text-slate-400 flex items-center gap-2">
                      <span>{item.category}</span>
                      <span>&bull;</span>
                      <span className="capitalize">{item.cadence}</span>
                      <span>&bull;</span>
                      <span>Next: {item.nextDate}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="font-bold text-slate-900 text-sm">${item.amount.toFixed(2)}</div>
                    <div className="text-[11px] text-slate-400">
                      ~${calcMonthly(item.amount, item.cadence).toFixed(2)}/mo
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="text-xs text-slate-500 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-100"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-slate-400 hover:text-rose-600 p-1.5 rounded hover:bg-rose-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Recurring Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="font-bold text-slate-900 text-base mb-4">
              {editingItem ? 'Edit Recurring Payment' : 'Add Recurring Payment'}
            </h3>

            <form onSubmit={handleSaveModal} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Payee / Service Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Electric Utility, Mortgage, Internet"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Cadence</label>
                  <select
                    value={cadence}
                    onChange={(e) => setCadence(e.target.value as Cadence)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Bi-weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Next Expected Date</label>
                  <input
                    type="date"
                    required
                    value={nextDate}
                    onChange={(e) => setNextDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
                  />
                </div>
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
                  {isSaving ? 'Saving...' : 'Save Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
