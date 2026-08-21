import React, { useState } from 'react';
import {
  Search,
  Filter,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  Trash2,
  Tag,
  Check,
  ChevronDown,
  X,
  Layers,
  UploadCloud
} from 'lucide-react';
import { AppState, DatePeriod, Transaction, TagItem } from '../types';
import { PeriodSelector, filterTransactionsByPeriod } from './PeriodSelector';
import { TagModal } from './TagModal';

interface TransactionsViewProps {
  state: AppState;
  onSelectPeriod: (period: DatePeriod) => void;
  onPatchCategory: (transactionId: string, category: string) => Promise<void>;
  onPatchTags: (transactionId: string, tags: string[]) => Promise<void>;
  onDeleteTransaction: (transactionId: string) => Promise<void>;
  onOpenAddEntry: () => void;
  onOpenImport: () => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  state,
  onSelectPeriod,
  onPatchCategory,
  onPatchTags,
  onDeleteTransaction,
  onOpenAddEntry,
  onOpenImport
}) => {
  const { transactions, settings, tags: allTags } = state;
  const { selectedPeriod, categories, accounts } = settings;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [editingTagTx, setEditingTagTx] = useState<Transaction | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // 1. Filter by period
  const periodFiltered = filterTransactionsByPeriod(transactions, selectedPeriod);

  // 2. Filter by search, category, and account
  const filteredTransactions = periodFiltered.filter((tx) => {
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchMerchant = tx.merchant.toLowerCase().includes(q);
      const matchCategory = tx.category.toLowerCase().includes(q);
      const matchTag = tx.tags.some((t) => t.toLowerCase().includes(q));
      if (!matchMerchant && !matchCategory && !matchTag) return false;
    }

    // Category filter
    if (selectedCategory !== 'all' && tx.category !== selectedCategory) {
      return false;
    }

    // Account filter
    if (selectedAccount !== 'all' && tx.account !== selectedAccount) {
      return false;
    }

    return true;
  });

  const handleCategoryChange = async (txId: string, newCat: string) => {
    try {
      await onPatchCategory(txId, newCat);
      setFeedback({ msg: 'Category updated', type: 'success' });
      setTimeout(() => setFeedback(null), 2500);
    } catch (err: any) {
      setFeedback({ msg: err.message || 'Failed to update category', type: 'error' });
    }
  };

  const handleRemoveTag = async (tx: Transaction, tagToRemove: string) => {
    const updated = tx.tags.filter((t) => t !== tagToRemove);
    try {
      await onPatchTags(tx.id, updated);
      setFeedback({ msg: 'Tag removed', type: 'success' });
      setTimeout(() => setFeedback(null), 2500);
    } catch (err: any) {
      setFeedback({ msg: err.message || 'Failed to update tag', type: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this transaction?')) return;
    setIsDeletingId(id);
    try {
      await onDeleteTransaction(id);
      setFeedback({ msg: 'Transaction deleted', type: 'success' });
      setTimeout(() => setFeedback(null), 2500);
    } catch (err: any) {
      setFeedback({ msg: err.message || 'Failed to delete transaction', type: 'error' });
    } finally {
      setIsDeletingId(null);
    }
  };

  return (
    <div id="transactions-view" className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Transactions</h2>
          <p className="text-sm text-slate-500">
            {filteredTransactions.length} records in {selectedPeriod.replace('-', ' ')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <PeriodSelector selectedPeriod={selectedPeriod} onSelectPeriod={onSelectPeriod} />
          <button
            id="tx-add-btn"
            onClick={onOpenAddEntry}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#6558D3] hover:bg-[#574abf] text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" /> Add entry
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="tx-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search merchant, tag, category..."
              className="w-full pl-9 pr-3 py-2 text-xs md:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div className="relative">
            <select
              id="tx-category-filter"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs md:text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
            >
              <option value="all">All Categories ({categories.length})</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Account Filter */}
          <div className="relative">
            <select
              id="tx-account-filter"
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="w-full px-3 py-2 text-xs md:text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
            >
              <option value="all">All Accounts ({accounts.length})</option>
              {accounts.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>

        {feedback && (
          <div
            className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>{feedback.msg}</span>
          </div>
        )}
      </div>

      {/* Transactions Table / List */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden">
        {filteredTransactions.length === 0 ? (
          <div className="py-16 px-4 text-center bg-slate-50/50">
            <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h4 className="text-base font-bold text-slate-700">No transactions found</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {transactions.length === 0
                ? 'Your transaction ledger is currently empty. Import a CSV statement or add entries manually to get started.'
                : 'No transactions matched your current search filters and date period.'}
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                onClick={onOpenAddEntry}
                className="px-4 py-2 bg-[#6558D3] hover:bg-[#574abf] text-white text-xs font-semibold rounded-xl shadow-xs"
              >
                Add entry
              </button>
              <button
                onClick={onOpenImport}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
              >
                Import statement
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm">
              <thead className="bg-slate-50/80 text-slate-500 text-[11px] font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Date &amp; Merchant</th>
                  <th className="py-3 px-4">Category (Inline)</th>
                  <th className="py-3 px-4 hidden md:table-cell">Account</th>
                  <th className="py-3 px-4">Tags</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center w-12">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredTransactions.map((tx) => {
                  const isIncome = tx.type === 'income';
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Date & Merchant */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900 flex items-center gap-1.5">
                          <span>{tx.merchant}</span>
                          {tx.receipt && (
                            <span
                              title="Receipt verified"
                              className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.2 rounded font-medium inline-flex items-center gap-0.5"
                            >
                              <Receipt className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">{tx.date}</div>
                      </td>

                      {/* Inline Category Dropdown */}
                      <td className="py-3.5 px-4">
                        <div className="relative inline-block max-w-[170px]">
                          <select
                            id={`cat-select-${tx.id}`}
                            value={tx.category}
                            onChange={(e) => handleCategoryChange(tx.id, e.target.value)}
                            className="text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#6558D3] cursor-pointer"
                          >
                            {categories.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>

                      {/* Account */}
                      <td className="py-3.5 px-4 hidden md:table-cell text-xs text-slate-600">
                        <span className="bg-slate-100 px-2 py-0.5 rounded-md font-medium">
                          {tx.account || 'Imported'}
                        </span>
                      </td>

                      {/* Inline Tags */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap items-center gap-1">
                          {tx.tags.map((t) => (
                            <span
                              key={t}
                              className="group inline-flex items-center gap-1 bg-violet-50 text-[#6558D3] border border-violet-100 px-2 py-0.5 rounded-full text-[11px] font-medium"
                            >
                              <span>{t}</span>
                              <button
                                onClick={() => handleRemoveTag(tx, t)}
                                className="text-violet-400 group-hover:text-rose-600 cursor-pointer"
                                title="Remove tag"
                              >
                                &times;
                              </button>
                            </span>
                          ))}
                          <button
                            id={`add-tag-${tx.id}`}
                            onClick={() => setEditingTagTx(tx)}
                            className="w-5 h-5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                            title="Add / Manage tags"
                          >
                            +
                          </button>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 text-right font-semibold whitespace-nowrap">
                        <span className={isIncome ? 'text-emerald-600' : 'text-slate-900'}>
                          {isIncome ? '+' : '-'}${tx.amount.toFixed(2)}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          id={`del-tx-${tx.id}`}
                          onClick={() => handleDelete(tx.id)}
                          disabled={isDeletingId === tx.id}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete transaction"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tag Editor Modal */}
      {editingTagTx && (
        <TagModal
          isOpen={true}
          onClose={() => setEditingTagTx(null)}
          transaction={editingTagTx}
          allTags={allTags}
          onSaveTags={async (txId, newTags) => {
            await onPatchTags(txId, newTags);
            setFeedback({ msg: 'Tags saved', type: 'success' });
            setTimeout(() => setFeedback(null), 2500);
          }}
        />
      )}
    </div>
  );
};
