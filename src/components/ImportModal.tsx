import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Layers,
  ChevronDown
} from 'lucide-react';
import { AppState, Transaction } from '../types';
import { parseCsvStatement, ParsedStatementResult } from '../lib/csvParser';
import { addTransactionsBulk, uploadDocuments } from '../lib/api';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: AppState;
  onSuccess: () => Promise<void>;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  state,
  onSuccess
}) => {
  if (!isOpen) return null;

  const { settings, rules, tags, transactions: existingTxs } = state;
  const { accounts, categories } = settings;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedAccount, setSelectedAccount] = useState(accounts[0] || 'Main Checking');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedStatementResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    inserted: number;
    duplicates: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setIsParsing(true);
    setError(null);
    setImportSummary(null);

    try {
      const text = await selectedFile.text();
      const result = parseCsvStatement(text, selectedAccount, categories);

      // Check duplicates against existing database
      const existingSignatures = new Set(
        existingTxs.map((t) => `${t.date}_${t.merchant.toLowerCase().trim()}_${t.amount.toFixed(2)}`)
      );

      let duplicateCount = 0;
      for (const row of result.rows) {
        const sig = `${row.date}_${row.merchant.toLowerCase().trim()}_${row.amount.toFixed(2)}`;
        if (existingSignatures.has(sig)) {
          duplicateCount++;
        }
      }

      result.duplicateCount = duplicateCount;
      setParsedData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to parse CSV file.');
      setParsedData(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleCommitImport = async () => {
    if (!parsedData || parsedData.rows.length === 0) return;
    setIsImporting(true);
    setError(null);

    try {
      // 1. Upload original CSV file to document vault
      if (file) {
        const fd = new FormData();
        fd.append('files', file);
        await uploadDocuments(fd);
      }

      // 2. Insert transactions into DB
      const res = await addTransactionsBulk(parsedData.rows);
      setImportSummary({
        inserted: res.insertedCount,
        duplicates: res.duplicateCount
      });

      await onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to import transactions.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        id="import-statement-modal"
        className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#6558D3]" />
            <h3 className="font-bold text-slate-900 text-base">Import Bank / Card Statement</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-4 overflow-y-auto flex-1">
          {importSummary ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-slate-900">Import Completed Successfully</h4>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                Inserted <span className="font-bold text-slate-900">{importSummary.inserted}</span> new
                transactions into your ledger.
                {importSummary.duplicates > 0 && (
                  <span>
                    {' '}
                    (Skipped {importSummary.duplicates} duplicate transactions automatically)
                  </span>
                )}
              </p>
              <div className="pt-4">
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-[#6558D3] hover:bg-[#574abf] text-white text-xs font-semibold rounded-xl shadow-xs"
                >
                  View Transactions
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Account Selection */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Destination Account / Card
                </label>
                <select
                  value={selectedAccount}
                  onChange={(e) => {
                    setSelectedAccount(e.target.value);
                    if (file) handleFileSelect(file);
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
                >
                  {accounts.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dropzone */}
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv,.txt"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                className="hidden"
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
                <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">
                  {file ? file.name : 'Select or drag CSV statement here'}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Standard bank exports (Chase, Amex, Wells Fargo, Citi, Apple Card, etc.)
                </p>
              </div>

              {/* Parsing Indicator */}
              {isParsing && (
                <div className="text-xs text-slate-500 flex items-center justify-center gap-2 py-4">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#6558D3]" />
                  <span>Analyzing columns and detecting format...</span>
                </div>
              )}

              {/* Preview Table */}
              {parsedData && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">
                      Parsed {parsedData.rows.length} transaction(s)
                    </span>
                    {parsedData.duplicateCount > 0 && (
                      <span className="text-amber-600 font-medium">
                        {parsedData.duplicateCount} possible duplicate(s) detected
                      </span>
                    )}
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="p-2">Date</th>
                          <th className="p-2">Merchant</th>
                          <th className="p-2">Category</th>
                          <th className="p-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedData.rows.slice(0, 10).map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2 text-slate-500">{row.date}</td>
                            <td className="p-2 font-medium text-slate-800">{row.merchant}</td>
                            <td className="p-2 text-slate-600">{row.category}</td>
                            <td className="p-2 text-right font-semibold">
                              <span className={row.type === 'income' ? 'text-emerald-600' : 'text-slate-900'}>
                                {row.type === 'income' ? '+' : '-'}${row.amount.toFixed(2)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsedData.rows.length > 10 && (
                    <p className="text-[11px] text-slate-400 text-right">
                      Showing first 10 of {parsedData.rows.length} entries
                    </p>
                  )}
                </div>
              )}

              {error && (
                <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </>
          )}
        </div>

        {!importSummary && (
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!parsedData || parsedData.rows.length === 0 || isImporting}
              onClick={handleCommitImport}
              className="px-4 py-2 bg-[#6558D3] hover:bg-[#574abf] text-white text-xs font-semibold rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-1.5"
            >
              {isImporting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Importing...
                </>
              ) : (
                <>
                  Import {parsedData ? `${parsedData.rows.length} entries` : 'Statement'}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
