import React, { useState } from 'react';
import {
  X,
  FolderSync,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  FileText
} from 'lucide-react';
import { AppState } from '../types';
import { syncDriveInbox } from '../lib/drive';
import { updatePreferences } from '../lib/api';

interface DriveSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: AppState;
  onSuccess: () => Promise<void>;
}

export const DriveSyncModal: React.FC<DriveSyncModalProps> = ({
  isOpen,
  onClose,
  state,
  onSuccess
}) => {
  if (!isOpen) return null;

  const { settings } = state;
  const { driveFolder, driveSync } = settings;

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusText, setSyncStatusText] = useState<string>('');
  const [syncResult, setSyncResult] = useState<{
    filesScanned: number;
    insertedCount: number;
    duplicateCount: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setError(null);
    setSyncResult(null);
    setSyncStatusText('Connecting to Google Drive and scanning folder...');

    try {
      const res = await syncDriveInbox((status) => {
        setSyncStatusText(status);
      });

      setSyncResult(res);
      await onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to sync with Google Drive');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        id="drive-sync-modal"
        className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FolderSync className="w-5 h-5 text-[#6558D3]" />
            <h3 className="font-bold text-slate-900 text-base">Google Drive Inbox Automation</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-4">
          {/* Information banner */}
          <div className="bg-violet-50/70 border border-violet-100 rounded-xl p-4 text-xs text-slate-700 space-y-2">
            <div className="flex items-center gap-2 text-[#6558D3] font-semibold">
              <Sparkles className="w-4 h-4" />
              <span>Automated Financial Inbox</span>
            </div>
            <p>
              Drop receipt photos (PNG/JPG) or PDF statements into your dedicated Google Drive folder:{' '}
              <strong className="text-slate-900 font-semibold">{driveFolder.name || 'Ledgerly Financial Inbox'}</strong>.
            </p>
            <p className="text-slate-500">
              The automated sync engine reads new files, preserves original documents in your secure vault, and extracts merchants, dates, and amounts without creating duplicates.
            </p>
          </div>

          {/* Folder Status Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Inbox Folder:</span>
              <span className="font-semibold text-slate-900">
                {driveFolder.name || 'Ledgerly Financial Inbox'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">Scheduled Automation:</span>
              <span className="bg-slate-200/70 text-slate-700 px-2 py-0.5 rounded font-mono font-medium">
                Daily at 8:00 AM PST
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">Last Synced:</span>
              <span className="text-slate-700 font-medium">
                {driveSync.lastSyncedAt
                  ? new Date(driveSync.lastSyncedAt).toLocaleString()
                  : 'Never synced'}
              </span>
            </div>

            {driveFolder.url && (
              <div className="pt-2 text-right">
                <a
                  href={driveFolder.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#6558D3] hover:underline font-semibold inline-flex items-center gap-1"
                >
                  Open in Google Drive <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>

          {/* Sync Progress / Results */}
          {isSyncing && (
            <div className="bg-slate-100 rounded-xl p-4 text-center space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin text-[#6558D3] mx-auto" />
              <p className="text-xs font-semibold text-slate-800">{syncStatusText}</p>
            </div>
          )}

          {syncResult && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-800 space-y-2">
              <div className="flex items-center gap-2 font-bold text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Sync Finished</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                  <div className="text-slate-400 text-[10px]">Files Scanned</div>
                  <div className="font-bold text-sm text-slate-800">{syncResult.filesScanned}</div>
                </div>
                <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                  <div className="text-slate-400 text-[10px]">New Entries</div>
                  <div className="font-bold text-sm text-emerald-700">{syncResult.insertedCount}</div>
                </div>
                <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                  <div className="text-slate-400 text-[10px]">Duplicates Skipped</div>
                  <div className="font-bold text-sm text-slate-600">{syncResult.duplicateCount}</div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
          >
            Close
          </button>
          <button
            type="button"
            disabled={isSyncing}
            onClick={handleSyncNow}
            className="px-4 py-2 bg-[#6558D3] hover:bg-[#574abf] text-white text-xs font-semibold rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing Drive...' : 'Run Sync Now'}
          </button>
        </div>
      </div>
    </div>
  );
};
