import React, { useState } from 'react';
import {
  Settings,
  Wallet,
  Tags,
  FolderSync,
  Sparkles,
  AlertTriangle,
  Plus,
  Trash2,
  CheckCircle2,
  ExternalLink,
  RotateCcw,
  ShieldAlert
} from 'lucide-react';
import { AppState, AppSettings, TagItem } from '../types';
import { wipeState } from '../lib/api';

interface SettingsViewProps {
  state: AppState;
  onUpdatePreferences: (prefs: Partial<AppSettings> | Record<string, any>) => Promise<void>;
  onRefreshState: () => Promise<void>;
  onOpenDriveSync: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  state,
  onUpdatePreferences,
  onRefreshState,
  onOpenDriveSync
}) => {
  const { settings, tags } = state;
  const {
    assets = 0,
    liabilities = 0,
    netWorthConfigured = false,
    categories = [],
    accounts = [],
    dismissedPatterns = [],
    driveFolder,
    driveSync
  } = settings;

  // Net Worth Form State
  const [assetInput, setAssetInput] = useState(assets.toString());
  const [liabilityInput, setLiabilityInput] = useState(liabilities.toString());
  const [isSavingNetWorth, setIsSavingNetWorth] = useState(false);
  const [netWorthFeedback, setNetWorthFeedback] = useState<string | null>(null);

  // Categories Form State
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryFeedback, setCategoryFeedback] = useState<string | null>(null);

  // Accounts Form State
  const [newAccountName, setNewAccountName] = useState('');

  // Erase Data Modal State
  const [isEraseModalOpen, setIsEraseModalOpen] = useState(false);
  const [eraseInput, setEraseInput] = useState('');
  const [isErasing, setIsErasing] = useState(false);
  const [eraseError, setEraseError] = useState<string | null>(null);

  // Live Net Worth preview
  const previewNetWorth = (parseFloat(assetInput) || 0) - (parseFloat(liabilityInput) || 0);

  // Save Net Worth
  const handleSaveNetWorth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingNetWorth(true);
    setNetWorthFeedback(null);
    try {
      const parsedAssets = Math.max(0, parseFloat(assetInput) || 0);
      const parsedLiab = Math.max(0, parseFloat(liabilityInput) || 0);
      await onUpdatePreferences({
        assets: parsedAssets,
        liabilities: parsedLiab,
        netWorthConfigured: true
      });
      setNetWorthFeedback('Net worth targets updated successfully!');
      setTimeout(() => setNetWorthFeedback(null), 3000);
    } finally {
      setIsSavingNetWorth(false);
    }
  };

  // Add Category
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    if (categories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      setCategoryFeedback(`Category "${trimmed}" already exists.`);
      return;
    }
    const updated = [...categories, trimmed];
    await onUpdatePreferences({ categories: updated });
    setNewCategoryName('');
    setCategoryFeedback(null);
  };

  const handleDeleteCategory = async (cat: string) => {
    if (cat === 'Needs review') {
      alert('Cannot delete the fallback "Needs review" category.');
      return;
    }
    if (!window.confirm(`Delete category "${cat}"?`)) return;
    const updated = categories.filter((c) => c !== cat);
    await onUpdatePreferences({ categories: updated });
  };

  // Add Account
  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newAccountName.trim();
    if (!trimmed) return;
    if (accounts.some((a) => a.toLowerCase() === trimmed.toLowerCase())) return;
    const updated = [...accounts, trimmed];
    await onUpdatePreferences({ accounts: updated });
    setNewAccountName('');
  };

  const handleDeleteAccount = async (acc: string) => {
    if (!window.confirm(`Delete account "${acc}"?`)) return;
    const updated = accounts.filter((a) => a !== acc);
    await onUpdatePreferences({ accounts: updated });
  };

  // Restore Dismissed Patterns
  const handleRestorePatterns = async () => {
    if (dismissedPatterns.length === 0) return;
    await onUpdatePreferences({ dismissedPatterns: [] });
    alert('All dismissed pattern suggestions have been restored to Recurring & Subscriptions.');
  };

  // Erase All Data
  const handleConfirmErase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (eraseInput.trim() !== 'DELETE') {
      setEraseError('Please type "DELETE" to confirm.');
      return;
    }

    setIsErasing(true);
    setEraseError(null);
    try {
      await wipeState('DELETE ALL LEDGERLY DATA');
      await onRefreshState();
      setIsEraseModalOpen(false);
      setEraseInput('');
      alert('All Ledgerly data has been wiped. Your dashboard is now in a fresh empty state.');
    } catch (err: any) {
      setEraseError(err.message || 'Failed to wipe data');
    } finally {
      setIsErasing(false);
    }
  };

  return (
    <div id="settings-view" className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Settings &amp; Preferences</h2>
        <p className="text-sm text-slate-500">
          Configure baseline net worth, accounts, custom categories, and automation preferences
        </p>
      </div>

      {/* 1. Net Worth Baseline Configuration */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Wallet className="w-5 h-5 text-[#6558D3]" />
          <div>
            <h3 className="font-bold text-slate-900 text-base">Net Worth Configuration</h3>
            <p className="text-xs text-slate-500">
              Calculate your overall Net Worth by logging your current total assets and total liabilities.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveNetWorth} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Total Assets ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={assetInput}
                onChange={(e) => setAssetInput(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Cash, savings, investments, home equity, property
              </span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Total Liabilities ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={liabilityInput}
                onChange={(e) => setLiabilityInput(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Mortgages, student loans, auto loans, credit card balances
              </span>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between border border-slate-100">
            <div>
              <span className="text-xs text-slate-500">Calculated Net Worth Preview:</span>
              <div
                className={`text-xl font-bold ${
                  previewNetWorth >= 0 ? 'text-slate-900' : 'text-rose-600'
                }`}
              >
                ${previewNetWorth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSavingNetWorth}
              className="px-4 py-2 bg-[#6558D3] hover:bg-[#574abf] text-white text-xs font-semibold rounded-xl shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isSavingNetWorth ? 'Saving...' : 'Save Net Worth'}
            </button>
          </div>

          {netWorthFeedback && (
            <div className="text-xs text-emerald-700 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>{netWorthFeedback}</span>
            </div>
          )}
        </form>
      </div>

      {/* 2. Managed Categories */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Managed Categories</h3>
            <p className="text-xs text-slate-500">
              Categories used throughout transaction logging, rules, and budget tracking
            </p>
          </div>

          <form onSubmit={handleAddCategory} className="flex gap-2">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="New category..."
              className="px-3 py-1.5 text-xs md:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
            />
            <button
              type="submit"
              disabled={!newCategoryName.trim()}
              className="px-3 py-1.5 bg-[#6558D3] hover:bg-[#574abf] text-white text-xs font-semibold rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </form>
        </div>

        {categoryFeedback && (
          <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
            {categoryFeedback}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <div
              key={cat}
              className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs"
            >
              <span className="font-medium text-slate-800">{cat}</span>
              {cat !== 'Needs review' && (
                <button
                  onClick={() => handleDeleteCategory(cat)}
                  className="text-slate-400 hover:text-rose-600 cursor-pointer"
                  title="Delete category"
                >
                  &times;
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 3. Managed Accounts */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Managed Account Labels</h3>
            <p className="text-xs text-slate-500">
              Accounts and card labels available during manual entry or CSV mapping
            </p>
          </div>

          <form onSubmit={handleAddAccount} className="flex gap-2">
            <input
              type="text"
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
              placeholder="e.g. Sapphire Preferred..."
              className="px-3 py-1.5 text-xs md:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
            />
            <button
              type="submit"
              disabled={!newAccountName.trim()}
              className="px-3 py-1.5 bg-[#6558D3] hover:bg-[#574abf] text-white text-xs font-semibold rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </form>
        </div>

        <div className="flex flex-wrap gap-2">
          {accounts.map((acc) => (
            <div
              key={acc}
              className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs"
            >
              <span className="font-medium text-slate-800">{acc}</span>
              <button
                onClick={() => handleDeleteAccount(acc)}
                className="text-slate-400 hover:text-rose-600 cursor-pointer"
                title="Delete account"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Automated Detection Engine Settings */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Automatic Detection Engine</h3>
            <p className="text-xs text-slate-500">
              Scans expense history for 5-9d, 12-17d, 24-40d, and annual intervals
            </p>
          </div>
          <span className="text-xs bg-violet-50 text-[#6558D3] border border-violet-100 px-2 py-0.5 rounded-full font-semibold">
            {dismissedPatterns.length} ignored pattern(s)
          </span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <p className="text-slate-600 max-w-md">
            If you previously dismissed suggested subscriptions or recurring bills, you can restore them so the algorithm re-evaluates your transactions.
          </p>

          <button
            onClick={handleRestorePatterns}
            disabled={dismissedPatterns.length === 0}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Restore ignored suggestions
          </button>
        </div>
      </div>

      {/* 5. Google Drive Sync Configuration */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FolderSync className="w-5 h-5 text-[#6558D3]" />
            <div>
              <h3 className="font-bold text-slate-900 text-base">Google Drive Inbox Automation</h3>
              <p className="text-xs text-slate-500">
                Scheduled daily at 8:00 AM (America/Los_Angeles)
              </p>
            </div>
          </div>

          <button
            onClick={onOpenDriveSync}
            className="px-3 py-1.5 bg-[#6558D3] text-white text-xs font-semibold rounded-xl hover:bg-[#574abf]"
          >
            Folder Settings
          </button>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 text-xs space-y-2 border border-slate-200/70">
          <div className="flex justify-between">
            <span className="text-slate-500">Inbox Folder:</span>
            <span className="font-semibold text-slate-800">{driveFolder.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Schedule:</span>
            <span className="text-slate-700">Every morning at 8:00 AM PST</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Duplicate Policy:</span>
            <span className="text-slate-700">Protected by transaction fingerprinting</span>
          </div>
          {driveFolder.url && (
            <div className="pt-2 text-right">
              <a
                href={driveFolder.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#6558D3] hover:underline font-semibold inline-flex items-center gap-1"
              >
                Open Inbox in Google Drive <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* 6. Danger Zone */}
      <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-6 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 text-rose-800">
          <ShieldAlert className="w-5 h-5 text-rose-600" />
          <h3 className="font-bold text-base">Danger Zone</h3>
        </div>

        <p className="text-xs text-rose-700 leading-relaxed max-w-2xl">
          Erase all Ledgerly data: permanently wipes all transactions, stored documents in the R2 vault, rules, custom tags, budgets, and resets your net worth configuration to fresh start.
        </p>

        <button
          onClick={() => {
            setEraseInput('');
            setEraseError(null);
            setIsEraseModalOpen(true);
          }}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer transition-all"
        >
          Erase all Ledgerly data
        </button>
      </div>

      {/* Erase Data Confirmation Modal */}
      {isEraseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-rose-200">
            <div className="flex items-center gap-2 text-rose-600 mb-3">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-slate-900 text-base">Confirm Complete Data Wipe</h3>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              This action is permanent and cannot be undone. All transactions, R2 vault documents, custom rules, and budgets will be deleted.
            </p>

            <form onSubmit={handleConfirmErase} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Type <span className="font-mono text-rose-600 font-bold">DELETE</span> to confirm:
                </label>
                <input
                  type="text"
                  required
                  value={eraseInput}
                  onChange={(e) => setEraseInput(e.target.value)}
                  placeholder="DELETE"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 font-mono"
                />
              </div>

              {eraseError && (
                <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                  {eraseError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEraseModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isErasing || eraseInput.trim() !== 'DELETE'}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-xs disabled:opacity-50"
                >
                  {isErasing ? 'Wiping...' : 'Permanently Delete All'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
