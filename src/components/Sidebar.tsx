import React from 'react';
import {
  LayoutDashboard,
  ReceiptText,
  Repeat,
  CalendarDays,
  PieChart,
  Target,
  FolderLock,
  Sliders,
  Settings,
  ShieldCheck,
  FolderSync
} from 'lucide-react';
import { AppState, NavTab } from '../types';
export type { NavTab };

interface SidebarProps {
  currentTab?: NavTab;
  activeTab?: NavTab;
  onSelectTab: (tab: NavTab) => void;
  state?: AppState | null;
  user?: any;
  onSignIn?: () => void;
  onSignOut?: () => void;
  driveConnected?: boolean;
}

export const NAV_ITEMS: { id: NavTab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: ReceiptText },
  { id: 'recurring', label: 'Recurring', icon: Repeat },
  { id: 'subscriptions', label: 'Subscriptions', icon: CalendarDays },
  { id: 'budgets', label: 'Budgets', icon: PieChart },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'documents', label: 'Documents', icon: FolderLock },
  { id: 'rules', label: 'Rules & Tags', icon: Sliders },
  { id: 'settings', label: 'Settings', icon: Settings }
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  activeTab,
  onSelectTab,
  state,
  user,
  onSignIn,
  onSignOut,
  driveConnected
}) => {
  const selectedTab = currentTab || activeTab || 'dashboard';
  const isDriveLinked = driveConnected || Boolean(state?.settings?.driveFolder?.id);

  return (
    <aside
      id="desktop-sidebar"
      className="hidden lg:flex flex-col w-[240px] min-w-[240px] bg-[#0F172A] text-slate-100 rounded-2xl border border-slate-800 shadow-sm sticky top-6 self-start max-h-[calc(100vh-48px)] select-none z-30 overflow-hidden"
    >
      {/* Brand Header */}
      <div className="h-[72px] flex items-center px-5 border-b border-slate-800/90 gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#6558D3] flex items-center justify-center shadow-md shadow-[#6558D3]/30">
          <ShieldCheck className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
            Ledgerly
            <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Private
            </span>
          </div>
          <div className="text-[11px] text-slate-400">Personal Finance</div>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 py-3 px-2.5 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = selectedTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-xs transition-all duration-150 text-left cursor-pointer ${
                isActive
                  ? 'bg-[#6558D3] text-white shadow-sm shadow-[#6558D3]/40 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Google Drive Status Bar */}
      <div className="p-3 border-t border-slate-800/90 bg-slate-900/50">
        <div className="bg-slate-800/70 border border-slate-700/60 rounded-xl p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isDriveLinked ? 'bg-emerald-400 ring-2 ring-emerald-400/20' : 'bg-amber-400'
              }`}
            />
            <div className="text-xs">
              <div className="text-slate-200 font-medium flex items-center gap-1">
                <FolderSync className="w-3 h-3 text-slate-400" />
                Drive Inbox
              </div>
              <div className="text-[10px] text-slate-400">Daily 8:00 AM</div>
            </div>
          </div>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
              isDriveLinked
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-slate-700 text-slate-400'
            }`}
          >
            {isDriveLinked ? 'Synced' : 'Ready'}
          </span>
        </div>
      </div>

      {/* User / Storage Footer */}
      <div className="p-3 border-t border-slate-800/90 bg-slate-950/40">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-7 h-7 rounded-full bg-[#6558D3] text-white text-xs flex items-center justify-center font-bold">
              L
            </div>
            <div className="truncate text-xs">
              <div className="text-slate-200 font-medium truncate">Owner Account</div>
              <div className="text-slate-400 text-[10px] truncate">Private Instance</div>
            </div>
          </div>
          <span className="text-[10px] text-slate-400 font-mono bg-slate-800 px-1.5 py-0.5 rounded">
            D1 DB
          </span>
        </div>
      </div>
    </aside>
  );
};

