import React, { useState } from 'react';
import {
  CalendarDays,
  Sparkles,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { AppState, SubscriptionItem, Cadence, DetectedPattern } from '../types';
import { detectPatterns } from '../lib/detection';

interface SubscriptionsViewProps {
  state: AppState;
  onUpdateSubscriptions: (items: SubscriptionItem[]) => Promise<void>;
  onDismissPattern: (key: string) => Promise<void>;
}

export const SubscriptionsView: React.FC<SubscriptionsViewProps> = ({
  state,
  onUpdateSubscriptions,
  onDismissPattern
}) => {
  const { transactions, settings } = state;
  const { subscriptions = [], recurring = [], dismissedPatterns = [], categories, accounts } = settings;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SubscriptionItem | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState(categories.find((c) => c.toLowerCase().includes('sub')) || categories[0] || 'Subscriptions');
  const [amount, setAmount] = useState('');
  const [cadence, setCadence] = useState<Cadence>('monthly');
  const [nextRenewal, setNextRenewal] = useState(new Date().toISOString().split('T')[0]);
  const [account, setAccount] = useState(accounts[0] || 'Everyday Visa');
  const [isSaving, setIsSaving] = useState(false);

  // Run automatic detection
  const detected = detectPatterns(
    transactions,
    dismissedPatterns,
    subscriptions.map((s) => s.name),
    recurring.map((r) => r.name)
  );
  const subscriptionSuggestions = detected.subscriptions;

  // Calculate commitments
  const calcMonthly = (amt: number, cad: Cadence) => {
    if (cad === 'weekly') return (amt * 52) / 12;
    if (cad === 'biweekly') return (amt * 26) / 12;
    if (cad === 'monthly') return amt;
    if (cad === 'quarterly') return amt / 3;
    if (cad === 'annual') return amt / 12;
    return amt;
  };

  const confirmedMonthly = subscriptions.reduce((sum, s) => sum + calcMonthly(s.amount, s.cadence), 0);
  const suggestionsMonthly = subscriptionSuggestions.reduce((sum, s) => sum + s.monthlyEquivalent, 0);
  const totalMonthly = confirmedMonthly + suggestionsMonthly;
  const totalAnnual = totalMonthly * 12;

  // Next renewal
  const sortedRenewals = [...subscriptions]
    .filter((s) => s.nextRenewal)
    .sort((a, b) => a.nextRenewal.localeCompare(b.nextRenewal));
  const nextSub = sortedRenewals[0];

  const handleOpenAdd = () => {
    setEditingItem(null);
    setName('');
    setCategory(categories.find((c) => c.toLowerCase().includes('sub')) || categories[0] || 'Subscriptions');
    setAmount('');
    setCadence('monthly');
    setNextRenewal(new Date().toISOString().split('T')[0]);
    setAccount(accounts[0] || 'Everyday Visa');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: SubscriptionItem) => {
    setEditingItem(item);
    setName(item.name);
    setCategory(item.category);
    setAmount(item.amount.toString());
    setCadence(item.cadence);
    setNextRenewal(item.nextRenewal);
    setAccount(item.account || accounts[0] || 'Everyday Visa');
    setIsModalOpen(true);
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isNaN(Number(amount)) || Number(amount) <= 0) return;

    setIsSaving(true);
    try {
      const parsedAmount = Math.abs(Number(amount));
      let updated: SubscriptionItem[];
      if (editingItem) {
        updated = subscriptions.map((s) =>
          s.id === editingItem.id
            ? { ...s, name: name.trim(), category, amount: parsedAmount, cadence, nextRenewal, account }
            : s
        );
      } else {
        const newItem: SubscriptionItem = {
          id: crypto.randomUUID(),
          name: name.trim(),
          category,
          amount: parsedAmount,
          cadence,
          nextRenewal,
          account,
          active: true
        };
        updated = [...subscriptions, newItem];
      }
      await onUpdateSubscriptions(updated);
      setIsModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this subscription?')) return;
    const updated = subscriptions.filter((s) => s.id !== id);
    await onUpdateSubscriptions(updated);
  };

  const handleKeepSuggestion = async (sug: DetectedPattern) => {
    const newItem: SubscriptionItem = {
      id: crypto.randomUUID(),
      name: sug.originalMerchant,
      category: sug.category,
      amount: sug.averageAmount,
      cadence: sug.cadence,
      nextRenewal: sug.nextDate,
      account: sug.account || 'Imported account',
      active: true
    };
    await onUpdateSubscriptions([...subscriptions, newItem]);
  };

  const handleIgnoreSuggestion = async (key: string) => {
    await onDismissPattern(key);
  };

  return (
    <div id="subscriptions-view" className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Subscriptions</h2>
          <p className="text-sm text-slate-500">
            Track active SaaS, streaming, cloud services, and memberships
          </p>
        </div>

        <button
          id="add-subscription-btn"
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#6558D3] hover:bg-[#574abf] text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Add subscription
        </button>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Monthly Subscription Total
          </span>
          <div className="text-2xl font-bold tracking-tight text-slate-900 mt-2">
            ${totalMonthly.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {subscriptions.length} active subscriptions
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Annual Subscription Cost
          </span>
          <div className="text-2xl font-bold tracking-tight text-slate-900 mt-2">
            ${totalAnnual.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-400 mt-1">Projected annual renewal cost</div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Next Renewal
          </span>
          <div className="text-2xl font-bold tracking-tight text-[#6558D3] mt-2">
            {nextSub ? `$${nextSub.amount.toFixed(2)}` : 'None'}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {nextSub ? `${nextSub.name} on ${nextSub.nextRenewal}` : 'No upcoming renewals'}
          </div>
        </div>
      </div>

      {/* Detected Subscription Suggestions */}
      {subscriptionSuggestions.length > 0 && (
        <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-[#6558D3]" />
            <h3 className="font-bold text-slate-900 text-sm">
              Detected Subscription Suggestions ({subscriptionSuggestions.length})
            </h3>
          </div>
          <p className="text-xs text-slate-600 mb-4">
            Recognized recurring subscription charges with low variation. Choose Keep to track or Ignore to dismiss.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {subscriptionSuggestions.map((sug) => (
              <div
                key={sug.key}
                className="bg-white border border-indigo-100 rounded-xl p-4 flex flex-col justify-between shadow-2xs"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{sug.originalMerchant}</div>
                      <div className="text-xs text-slate-500">
                        {sug.category} &bull; {sug.cadence} ({sug.occurrences} charges)
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
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

      {/* Confirmed Subscription List */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-base">Active Subscriptions</h3>
          <span className="text-xs text-slate-500">{subscriptions.length} services</span>
        </div>

        {subscriptions.length === 0 ? (
          <div className="py-14 px-4 text-center bg-slate-50/50">
            <CalendarDays className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-slate-700">No subscriptions tracked yet</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Add your subscriptions manually or import statements to let Ledgerly auto-detect them.
            </p>
            <button
              onClick={handleOpenAdd}
              className="mt-4 px-4 py-2 bg-[#6558D3] hover:bg-[#574abf] text-white text-xs font-semibold rounded-xl"
            >
              Add subscription
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {subscriptions.map((item) => (
              <div key={item.id} className="p-4 md:px-6 flex items-center justify-between gap-4 hover:bg-slate-50/60">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-[#6558D3] flex items-center justify-center font-bold">
                    <CalendarDays className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-900 text-sm">{item.name}</div>
                    <div className="text-xs text-slate-400 flex items-center gap-2">
                      <span>{item.category}</span>
                      <span>&bull;</span>
                      <span className="capitalize">{item.cadence}</span>
                      <span>&bull;</span>
                      <span>Renews: {item.nextRenewal}</span>
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

      {/* Add / Edit Subscription Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="font-bold text-slate-900 text-base mb-4">
              {editingItem ? 'Edit Subscription' : 'Add Subscription'}
            </h3>

            <form onSubmit={handleSaveModal} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Service / App Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Netflix, Spotify, iCloud, GitHub"
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
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Billing Cadence</label>
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
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Next Renewal Date</label>
                  <input
                    type="date"
                    required
                    value={nextRenewal}
                    onChange={(e) => setNextRenewal(e.target.value)}
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
                  {isSaving ? 'Saving...' : 'Save Subscription'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
