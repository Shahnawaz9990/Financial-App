import React, { useState, useRef } from 'react';
import {
  FolderLock,
  UploadCloud,
  FolderSync,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  Download,
  Trash2,
  ExternalLink,
  RefreshCw,
  Eye,
  ShieldCheck
} from 'lucide-react';
import { AppState, DocumentItem } from '../types';
import { uploadDocuments, deleteDocument } from '../lib/api';

interface DocumentsViewProps {
  state: AppState;
  onRefreshState: () => Promise<void>;
  onOpenDriveSync: () => void;
  onQuickSync: () => void;
  isSyncingDrive: boolean;
}

export const DocumentsView: React.FC<DocumentsViewProps> = ({
  state,
  onRefreshState,
  onOpenDriveSync,
  onQuickSync,
  isSyncingDrive
}) => {
  const { documents = [], settings } = state;
  const { driveFolder, driveSync } = settings;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setUploadMessage(null);

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      if (files[i].size > 20 * 1024 * 1024) {
        setUploadMessage({
          text: `File "${files[i].name}" exceeds maximum allowed size of 20MB.`,
          type: 'error'
        });
        setIsUploading(false);
        return;
      }
      formData.append('files', files[i]);
    }

    try {
      const res = await uploadDocuments(formData);
      await onRefreshState();
      setUploadMessage({
        text: `Successfully uploaded ${res.documents.length} document(s) to R2 vault!`,
        type: 'success'
      });
      setTimeout(() => setUploadMessage(null), 4000);
    } catch (err: any) {
      setUploadMessage({
        text: err.message || 'Failed to upload document',
        type: 'error'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleDelete = async (id: string, filename: string) => {
    if (!window.confirm(`Delete document "${filename}" from vault?`)) return;
    setDeletingId(id);
    try {
      await deleteDocument(id);
      await onRefreshState();
    } catch (err: any) {
      alert(err.message || 'Failed to delete document');
    } finally {
      setDeletingId(null);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div id="documents-view" className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Document Vault &amp; Inbox</h2>
          <p className="text-sm text-slate-500">
            Secure R2 object storage for receipts, statements, invoices, and Google Drive syncing
          </p>
        </div>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#6558D3] hover:bg-[#574abf] text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer transition-all self-start sm:self-auto"
        >
          <UploadCloud className="w-4 h-4" /> Upload documents
        </button>
      </div>

      {/* Top Two Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Upload Documents Dropzone */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <UploadCloud className="w-5 h-5 text-[#6558D3]" />
              <h3 className="font-bold text-slate-900 text-base">Direct Vault Upload</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Upload PDF receipts, statements, invoice images, or CSV statements up to 20MB.
            </p>

            <input
              type="file"
              ref={fileInputRef}
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.csv,.txt"
            />

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                dragActive
                  ? 'border-[#6558D3] bg-violet-50/50'
                  : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
              }`}
            >
              <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">
                {isUploading ? 'Encrypting & Storing in Vault...' : 'Drag & drop files here, or browse'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                PDF, JPG, PNG, CSV (Max 20MB per file)
              </p>
            </div>

            {uploadMessage && (
              <div
                className={`mt-3 text-xs p-2.5 rounded-xl border flex items-center gap-2 ${
                  uploadMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}
              >
                {uploadMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span>{uploadMessage.text}</span>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>R2 Vault simulation enabled</span>
            <span className="text-emerald-600 font-medium">Original bytes preserved</span>
          </div>
        </div>

        {/* Card 2: Google Drive Inbox Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FolderSync className="w-5 h-5 text-[#6558D3]" />
                <h3 className="font-bold text-slate-900 text-base">Google Drive Inbox</h3>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-violet-50 text-[#6558D3] border border-violet-100">
                Daily 8:00 AM
              </span>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              Dedicated import folder in your Google Drive. Drop financial PDFs or photos into this folder for automatic parsing.
            </p>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/70 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Folder Name:</span>
                <span className="font-semibold text-slate-800">
                  {driveFolder.name || 'Ledgerly Financial Inbox'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Schedule:</span>
                <span className="font-medium text-slate-700">Daily 8:00 AM (America/Los_Angeles)</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Last Synced:</span>
                <span className="text-slate-700">
                  {driveSync.lastSyncedAt
                    ? new Date(driveSync.lastSyncedAt).toLocaleString()
                    : 'Never synced'}
                </span>
              </div>

              {driveFolder.url && (
                <div className="pt-1 flex items-center justify-end">
                  <a
                    href={driveFolder.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#6558D3] hover:underline font-medium flex items-center gap-1"
                  >
                    Open in Google Drive <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
            <button
              onClick={onOpenDriveSync}
              className="text-xs text-slate-600 hover:text-slate-900 font-medium"
            >
              Configure Folder
            </button>
            <button
              onClick={onQuickSync}
              disabled={isSyncingDrive}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingDrive ? 'animate-spin' : ''}`} />
              {isSyncingDrive ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        </div>
      </div>

      {/* Document Vault List */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderLock className="w-4 h-4 text-slate-500" />
            <h3 className="font-bold text-slate-900 text-base">Document Vault</h3>
          </div>
          <span className="text-xs text-slate-500">{documents.length} files securely stored</span>
        </div>

        {documents.length === 0 ? (
          <div className="py-16 px-4 text-center bg-slate-50/50">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h4 className="text-base font-bold text-slate-700">No documents in vault</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Upload invoices or receipts, or sync files from your Google Drive inbox folder.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm">
              <thead className="bg-slate-50/80 text-slate-500 text-[11px] font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Filename</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Imported</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-slate-900 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="truncate max-w-[200px] md:max-w-xs">{doc.filename}</span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500 capitalize">
                      {doc.source === 'google-drive' ? 'Google Drive' : 'Manual Upload'}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500">{formatSize(doc.size)}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider ${
                          doc.status === 'stored'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : doc.status === 'review'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {doc.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-400">
                      {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`/api/documents/${doc.id}/download`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100"
                          title="View / Download Original"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => handleDelete(doc.id, doc.filename)}
                          disabled={deletingId === doc.id}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
                          title="Delete from Vault"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
