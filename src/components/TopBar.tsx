import React from 'react';
import {
  FolderSync,
  UploadCloud,
  PlusCircle,
  ShieldCheck
} from 'lucide-react';
import { AppState, NavTab } from '../types';

interface TopBarProps {
  state?: AppState | null;
  currentTab?: NavTab;
  onSelectTab?: (tab: NavTab) => void;
  onOpenAddEntry: () => void;
  onOpenImport: () => void;
  onOpenDriveSync: () => void;
  isSyncingDrive?: boolean;
  onQuickSync?: () => void;
  driveFolder?: { id: string; name: string; url?: string };
  isSyncing?: boolean;
  driveConnected?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  state,
  currentTab,
  onSelectTab,
  onOpenAddEntry,
  onOpenImport,
  onOpenDriveSync,
  isSyncingDrive,
  onQuickSync,
  driveFolder: propDriveFolder,
  isSyncing: propIsSyncing,
  driveConnected
}) => {
  const driveFolder = propDriveFolder || state?.settings?.driveFolder || { id: '', name: '' };
  const isSyncing = isSyncingDrive ?? propIsSyncing ?? false;
  const isDriveLinked = driveConnected || Boolean(driveFolder.id);

  return (
    <header
      id="global-topbar"
      className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200 h-[72px] px-4 sm:px-6 lg:px-8 flex items-center justify-between transition-colors shadow-2xs"
    >
      {/* Title & Drive quick info */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:block">
          <h1 className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2">
            Ledgerly
            <span className="text-[11px] font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
              D1 + R2 Vault
            </span>
          </h1>
          <p className="text-xs text-slate-500 hidden md:block">
            Private personal finance with automated 8:00 AM Drive inbox sync
          </p>
        </div>

        <div className="sm:hidden flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#6558D3] flex items-center justify-center text-white font-bold text-sm shadow-xs">
            L
          </div>
          <span className="font-bold text-slate-900 text-base">Ledgerly</span>
        </div>
      </div>

      {/* Global Action Buttons */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Drive Sync Button */}
        <button
          id="topbar-drive-sync-btn"
          onClick={onOpenDriveSync}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 shadow-2xs transition-all cursor-pointer"
          title={driveFolder.id ? `Folder: ${driveFolder.name}` : 'Connect Drive Folder'}
        >
          <FolderSync className={`w-3.5 h-3.5 text-[#6558D3] ${isSyncing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Drive Sync</span>
          {isDriveLinked && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 hidden sm:inline" />
          )}
        </button>

        {/* Import Button */}
        <button
          id="topbar-import-btn"
          onClick={onOpenImport}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 shadow-2xs transition-all cursor-pointer"
        >
          <UploadCloud className="w-3.5 h-3.5 text-slate-500" />
          <span>Import</span>
        </button>

        {/* Add Entry Primary Button */}
        <button
          id="topbar-add-entry-btn"
          onClick={onOpenAddEntry}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl text-white bg-[#6558D3] hover:bg-[#574abf] shadow-xs shadow-[#6558D3]/30 transition-all cursor-pointer active:scale-[0.98]"
        >
          <PlusCircle className="w-3.5 h-3.5 text-white" />
          <span>Add Entry</span>
        </button>
      </div>
    </header>
  );
};

