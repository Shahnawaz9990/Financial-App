import { AppState, Transaction, AppSettings, DatePeriod, DocumentItem, RuleItem, TagItem } from '../types';

export async function fetchState(): Promise<AppState> {
  const res = await fetch('/api/state');
  if (!res.ok) {
    throw new Error(`Failed to load state: ${res.statusText}`);
  }
  return res.json();
}

export async function postTransactions(transactions: Partial<Transaction> | Partial<Transaction>[]) {
  const res = await fetch('/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(transactions)
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to add transactions: ${res.statusText}`);
  }
  return res.json();
}

export async function addTransaction(transaction: Partial<Transaction>): Promise<Transaction> {
  const res = await postTransactions(transaction);
  return res.transactions?.[0] || res;
}

export async function addTransactionsBulk(transactions: Partial<Transaction>[]): Promise<{
  success: boolean;
  insertedCount: number;
  duplicateCount: number;
}> {
  const res = await postTransactions(transactions);
  return {
    success: true,
    insertedCount: res.insertedCount || (Array.isArray(res) ? res.length : 1),
    duplicateCount: res.duplicateCount || 0
  };
}

export async function patchTransaction(id: string, updates: { category?: string; tags?: string[] }): Promise<Transaction> {
  const res = await fetch(`/api/transactions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to update transaction: ${res.statusText}`);
  }
  return res.json();
}

export async function patchTransactionCategory(id: string, category: string): Promise<Transaction> {
  return patchTransaction(id, { category });
}

export async function patchTransactionTags(id: string, tags: string[]): Promise<Transaction> {
  return patchTransaction(id, { tags });
}

export async function deleteTransaction(id: string): Promise<void> {
  const res = await fetch(`/api/transactions/${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) {
    throw new Error(`Failed to delete transaction: ${res.statusText}`);
  }
}

export async function updatePreferences(prefs: Partial<AppSettings> | Record<string, any>): Promise<{ success: boolean }> {
  const res = await fetch('/api/preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prefs)
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to update preferences: ${res.statusText}`);
  }
  return res.json();
}

export async function updateRules(rules: RuleItem[]): Promise<{ success: boolean }> {
  return updatePreferences({ rules });
}

export async function updateTags(tags: TagItem[]): Promise<{ success: boolean }> {
  return updatePreferences({ tags });
}

export async function uploadDocuments(formData: FormData): Promise<{
  success: boolean;
  documents: { document: DocumentItem; extracted?: any }[];
  extractedTransactions: Transaction[];
}> {
  const res = await fetch('/api/documents', {
    method: 'POST',
    body: formData
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to upload documents: ${res.statusText}`);
  }
  return res.json();
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await fetch(`/api/documents/${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) {
    throw new Error(`Failed to delete document: ${res.statusText}`);
  }
}

export async function wipeState(confirmation: string): Promise<{ success: boolean; wipedAt: string }> {
  const res = await fetch('/api/state', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmation })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to wipe data: ${res.statusText}`);
  }
  return res.json();
}

export async function getDriveSyncMeta() {
  const res = await fetch('/api/drive-sync');
  if (!res.ok) {
    throw new Error(`Failed to fetch Drive sync status: ${res.statusText}`);
  }
  return res.json();
}

export async function postDriveSyncBatch(batch: {
  files?: any[];
  transactions?: any[];
  errors?: string[];
}) {
  const res = await fetch('/api/drive-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(batch)
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Drive sync failed: ${res.statusText}`);
  }
  return res.json();
}

export async function updateDriveConfig(folderId: string, folderName?: string, folderUrl?: string) {
  const res = await fetch('/api/drive/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folderId, folderName, folderUrl })
  });
  if (!res.ok) {
    throw new Error(`Failed to update Drive config: ${res.statusText}`);
  }
  return res.json();
}
