import React, { useState, useEffect, useCallback } from 'react';
import {
  NavTab,
  AppState,
  DatePeriod,
  Transaction,
  RecurringPaymentItem,
  SubscriptionItem,
  BudgetItem,
  GoalItem,
  RuleItem,
  TagItem,
  AppSettings
} from './types';
import {
  fetchState,
  updatePreferences,
  patchTransactionCategory,
  patchTransactionTags,
  deleteTransaction,
  addTransaction,
  updateRules,
  updateTags
} from './lib/api';
import { syncDriveInbox } from './lib/drive';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { MobileNav } from './components/MobileNav';
import { DashboardView } from './components/DashboardView';
import { TransactionsView } from './components/TransactionsView';
import { RecurringView } from './components/RecurringView';
import { SubscriptionsView } from './components/SubscriptionsView';
import { BudgetsView } from './components/BudgetsView';
import { GoalsView } from './components/GoalsView';
import { DocumentsView } from './components/DocumentsView';
import { RulesView } from './components/RulesView';
import { SettingsView } from './components/SettingsView';
import { AddEntryModal } from './components/AddEntryModal';
import { ImportModal } from './components/ImportModal';
import { DriveSyncModal } from './components/DriveSyncModal';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [state, setState] = useState<AppState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isAddEntryOpen, setIsAddEntryOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isDriveSyncOpen, setIsDriveSyncOpen] = useState(false);
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);

  // Load state from backend
  const loadAppState = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchState();
      setState(data);
    } catch (err: any) {
      console.error('Failed to load app state:', err);
      setError(err.message || 'Unable to connect to Ledgerly database.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAppState();
  }, [loadAppState]);

  // Handlers for state updates
  const handleSelectPeriod = async (period: DatePeriod) => {
    if (!state) return;
    setState((prev) =>
      prev ? { ...prev, settings: { ...prev.settings, selectedPeriod: period } } : prev
    );
    try {
      await updatePreferences({ selectedPeriod: period });
    } catch (err) {
      console.error('Failed to persist period:', err);
    }
  };

  const handlePatchCategory = async (txId: string, category: string) => {
    // Optimistic UI update
    setState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        transactions: prev.transactions.map((tx) =>
          tx.id === txId ? { ...tx, category } : tx
        )
      };
    });
    await patchTransactionCategory(txId, category);
  };

  const handlePatchTags = async (txId: string, tags: string[]) => {
    setState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        transactions: prev.transactions.map((tx) =>
          tx.id === txId ? { ...tx, tags } : tx
        )
      };
    });
    await patchTransactionTags(txId, tags);
    // Reload state to pick up any new globally registered tags
    const refreshed = await fetchState();
    setState(refreshed);
  };

  const handleDeleteTransaction = async (txId: string) => {
    setState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        transactions: prev.transactions.filter((tx) => tx.id !== txId)
      };
    });
    await deleteTransaction(txId);
  };

  const handleAddTransaction = async (tx: Partial<Transaction>) => {
    const created = await addTransaction(tx);
    await loadAppState();
  };

  const handleUpdateRecurring = async (items: RecurringPaymentItem[]) => {
    setState((prev) =>
      prev ? { ...prev, settings: { ...prev.settings, recurring: items } } : prev
    );
    await updatePreferences({ recurring: items });
  };

  const handleUpdateSubscriptions = async (items: SubscriptionItem[]) => {
    setState((prev) =>
      prev ? { ...prev, settings: { ...prev.settings, subscriptions: items } } : prev
    );
    await updatePreferences({ subscriptions: items });
  };

  const handleDismissPattern = async (key: string) => {
    if (!state) return;
    const currentDismissed = state.settings.dismissedPatterns || [];
    if (!currentDismissed.includes(key)) {
      const updated = [...currentDismissed, key];
      setState((prev) =>
        prev ? { ...prev, settings: { ...prev.settings, dismissedPatterns: updated } } : prev
      );
      await updatePreferences({ dismissedPatterns: updated });
    }
  };

  const handleUpdateBudgets = async (budgets: BudgetItem[]) => {
    setState((prev) =>
      prev ? { ...prev, settings: { ...prev.settings, budgets } } : prev
    );
    await updatePreferences({ budgets });
  };

  const handleUpdateGoals = async (goals: GoalItem[]) => {
    setState((prev) =>
      prev ? { ...prev, settings: { ...prev.settings, goals } } : prev
    );
    await updatePreferences({ goals });
  };

  const handleUpdateRules = async (rules: RuleItem[]) => {
    setState((prev) => (prev ? { ...prev, rules } : prev));
    await updateRules(rules);
  };

  const handleUpdateTags = async (tags: TagItem[]) => {
    setState((prev) => (prev ? { ...prev, tags } : prev));
    await updateTags(tags);
  };

  const handleUpdatePreferences = async (prefs: Partial<AppSettings> | Record<string, any>) => {
    setState((prev) =>
      prev ? { ...prev, settings: { ...prev.settings, ...prefs } } : prev
    );
    await updatePreferences(prefs);
    await loadAppState();
  };

  const handleQuickDriveSync = async () => {
    setIsSyncingDrive(true);
    try {
      await syncDriveInbox();
      await loadAppState();
    } catch (err: any) {
      console.error('Drive quick sync error:', err);
      alert(err.message || 'Failed to sync with Google Drive');
    } finally {
      setIsSyncingDrive(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F3F4F6] flex flex-col items-center justify-center p-6 text-slate-700">
        <div className="w-12 h-12 rounded-2xl bg-[#6558D3] flex items-center justify-center text-white font-bold text-xl shadow-md mb-4 animate-bounce">
          L
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Loader2 className="w-4 h-4 animate-spin text-[#6558D3]" />
          <span>Opening Ledgerly...</span>
        </div>
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="min-h-screen bg-[#F3F4F6] flex flex-col items-center justify-center p-6 text-slate-800">
        <div className="bg-white p-8 rounded-2xl border border-rose-200 shadow-sm max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto text-xl font-bold">
            !
          </div>
          <h2 className="text-lg font-bold text-slate-900">Database Connection Issue</h2>
          <p className="text-xs text-slate-600 leading-relaxed">{error}</p>
          <button
            onClick={() => {
              setIsLoading(true);
              loadAppState();
            }}
            className="w-full py-2.5 bg-[#6558D3] hover:bg-[#574abf] text-white text-xs font-semibold rounded-xl shadow-xs"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3F4F6] flex flex-col antialiased text-[#111827] selection:bg-[#6558D3]/20">
      {/* Top Navigation Bar */}
      <TopBar
        state={state}
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenAddEntry={() => setIsAddEntryOpen(true)}
        onOpenImport={() => setIsImportOpen(true)}
        onOpenDriveSync={() => setIsDriveSyncOpen(true)}
        onQuickSync={handleQuickDriveSync}
        isSyncingDrive={isSyncingDrive}
      />

      {/* Main Layout Body */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 gap-6">
        {/* Desktop Left Sidebar */}
        <Sidebar currentTab={currentTab} onSelectTab={setCurrentTab} state={state} />

        {/* Dynamic Main View Area */}
        <main className="flex-1 min-w-0 pb-20 md:pb-6">
          {currentTab === 'dashboard' && (
            <DashboardView
              state={state}
              onSelectTab={setCurrentTab}
              onSelectPeriod={handleSelectPeriod}
              onOpenAddEntry={() => setIsAddEntryOpen(true)}
              onOpenImport={() => setIsImportOpen(true)}
              onOpenDriveSync={() => setIsDriveSyncOpen(true)}
            />
          )}

          {currentTab === 'transactions' && (
            <TransactionsView
              state={state}
              onSelectPeriod={handleSelectPeriod}
              onPatchCategory={handlePatchCategory}
              onPatchTags={handlePatchTags}
              onDeleteTransaction={handleDeleteTransaction}
              onOpenAddEntry={() => setIsAddEntryOpen(true)}
              onOpenImport={() => setIsImportOpen(true)}
            />
          )}

          {currentTab === 'recurring' && (
            <RecurringView
              state={state}
              onUpdateRecurring={handleUpdateRecurring}
              onDismissPattern={handleDismissPattern}
            />
          )}

          {currentTab === 'subscriptions' && (
            <SubscriptionsView
              state={state}
              onUpdateSubscriptions={handleUpdateSubscriptions}
              onDismissPattern={handleDismissPattern}
            />
          )}

          {currentTab === 'budgets' && (
            <BudgetsView state={state} onUpdateBudgets={handleUpdateBudgets} />
          )}

          {currentTab === 'goals' && (
            <GoalsView state={state} onUpdateGoals={handleUpdateGoals} />
          )}

          {currentTab === 'documents' && (
            <DocumentsView
              state={state}
              onRefreshState={loadAppState}
              onOpenDriveSync={() => setIsDriveSyncOpen(true)}
              onQuickSync={handleQuickDriveSync}
              isSyncingDrive={isSyncingDrive}
            />
          )}

          {currentTab === 'rules' && (
            <RulesView
              state={state}
              onUpdateRules={handleUpdateRules}
              onUpdateTags={handleUpdateTags}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              state={state}
              onUpdatePreferences={handleUpdatePreferences}
              onRefreshState={loadAppState}
              onOpenDriveSync={() => setIsDriveSyncOpen(true)}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenAddEntry={() => setIsAddEntryOpen(true)}
      />

      {/* Overlays / Modals */}
      <AddEntryModal
        isOpen={isAddEntryOpen}
        onClose={() => setIsAddEntryOpen(false)}
        state={state}
        onAddTransaction={handleAddTransaction}
      />

      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        state={state}
        onSuccess={loadAppState}
      />

      <DriveSyncModal
        isOpen={isDriveSyncOpen}
        onClose={() => setIsDriveSyncOpen(false)}
        state={state}
        onSuccess={loadAppState}
      />
    </div>
  );
}
