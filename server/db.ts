import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { wipeAllBucketObjects } from './storage.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'ledgerly.sqlite3');

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;

const DEFAULT_CATEGORIES = [
  'Housing',
  'Groceries',
  'Shopping',
  'Dining',
  'Transportation',
  'Utilities',
  'Subscriptions',
  'Insurance',
  'Health',
  'Entertainment',
  'Income',
  'Needs review',
  'Other'
];

const DEFAULT_ACCOUNTS = [
  'Main Checking',
  'Everyday Visa',
  'Rewards Card',
  'Cash'
];

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function saveDbToDisk() {
  if (!db) return;
  ensureDataDir();
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

export async function getDb(): Promise<Database> {
  if (db) return db;
  ensureDataDir();

  if (!SQL) {
    SQL = await initSqlJs();
  }

  if (fs.existsSync(DB_PATH)) {
    try {
      const fileBuffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(fileBuffer);
    } catch (e) {
      console.warn('Failed to load existing SQLite database from disk, creating new one:', e);
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
  }

  initSchema(db);
  return db;
}

function initSchema(database: Database) {
  database.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      merchant TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Needs review',
      amount REAL NOT NULL,
      type TEXT NOT NULL,
      account TEXT NOT NULL DEFAULT 'Imported account',
      tags TEXT NOT NULL DEFAULT '[]',
      receipt INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL,
      fingerprint TEXT NOT NULL UNIQUE,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tags (
      name TEXT PRIMARY KEY,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rules (
      id TEXT PRIMARY KEY,
      whenText TEXT NOT NULL,
      thenText TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      mimeType TEXT NOT NULL,
      size INTEGER NOT NULL,
      objectKey TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      source TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
  `);

  // Initialize structural default settings if missing
  const initSetting = (key: string, defaultValue: any) => {
    const stmt = database.prepare('SELECT value FROM settings WHERE key = :key');
    stmt.bind({ ':key': key });
    const exists = stmt.step();
    stmt.free();
    if (!exists) {
      const now = new Date().toISOString();
      const insertStmt = database.prepare('INSERT INTO settings (key, value, updatedAt) VALUES (:key, :value, :updatedAt)');
      insertStmt.run({
        ':key': key,
        ':value': typeof defaultValue === 'string' ? defaultValue : JSON.stringify(defaultValue),
        ':updatedAt': now
      });
      insertStmt.free();
    }
  };

  initSetting('categories', DEFAULT_CATEGORIES);
  initSetting('accounts', DEFAULT_ACCOUNTS);
  initSetting('goals', []);
  initSetting('budgets', []);
  initSetting('subscriptions', []);
  initSetting('recurring', []);
  initSetting('dismissedPatterns', []);
  initSetting('selectedPeriod', 'all-time');
  initSetting('assets', 0);
  initSetting('liabilities', 0);
  initSetting('netWorthConfigured', false);
  initSetting('freshStart', false);
  initSetting('driveFolder', { name: 'Ledgerly Financial Inbox', id: '', url: '' });
  initSetting('driveSync', {
    lastSyncedAt: null,
    status: 'idle',
    imported: 0,
    duplicates: 0,
    stored: 0,
    review: 0,
    errors: []
  });
  initSetting('processedFileIds', []);
  initSetting('driveResetAt', null);

  saveDbToDisk();
}

// Fingerprint calculation formula
export function computeFingerprint(date: string, merchant: string, amount: number, account: string): string {
  const normDate = date.trim();
  const normMerchant = merchant.trim().toLowerCase();
  const normAmount = Number(amount).toFixed(2);
  const normAccount = (account || 'Imported account').trim().toLowerCase();
  return `${normDate}|${normMerchant}|${normAmount}|${normAccount}`;
}

export interface TransactionInput {
  id?: string;
  date: string;
  merchant: string;
  category?: string;
  amount: number;
  type: 'expense' | 'income';
  account?: string;
  tags?: string[];
  receipt?: boolean | number;
  source?: string;
}

export interface RuleRow {
  id: string;
  whenText: string;
  thenText: string;
  enabled: number;
  createdAt: string;
}

// Apply rules after duplicate check
export function applyRulesToTransaction(tx: { merchant: string; category?: string; tags?: string[]; source?: string }, rules: RuleRow[]): { category?: string; tags: string[] } {
  let category = tx.category || 'Needs review';
  const tagsSet = new Set<string>((tx.tags || []).map(t => t.trim()).filter(Boolean));
  const merchantLower = (tx.merchant || '').toLowerCase();
  const sourceLower = (tx.source || '').toLowerCase();

  for (const rule of rules) {
    if (!rule.enabled) continue;
    const whenLower = rule.whenText.toLowerCase().trim();
    if (whenLower && (merchantLower.includes(whenLower) || sourceLower.includes(whenLower))) {
      // rule thenText might specify category or tag, e.g. "Category: Groceries", "Tag: Subscription", or just a category name
      const then = rule.thenText.trim();
      if (then.toLowerCase().startsWith('tag:') || then.toLowerCase().startsWith('tag =')) {
        const tagName = then.split(/[:=]/)[1]?.trim();
        if (tagName) tagsSet.add(tagName);
      } else if (then.toLowerCase().startsWith('category:') || then.toLowerCase().startsWith('category =')) {
        const catName = then.split(/[:=]/)[1]?.trim();
        if (catName) category = catName;
      } else {
        // Direct category name
        category = then;
      }
    }
  }

  return { category, tags: Array.from(tagsSet) };
}

export async function getState() {
  const database = await getDb();

  // Transactions (up to 5000, newest first)
  const txStmt = database.prepare(`
    SELECT id, date, merchant, category, amount, type, account, tags, receipt, source, fingerprint, createdAt
    FROM transactions
    ORDER BY date DESC, createdAt DESC
    LIMIT 5000
  `);
  const transactions: any[] = [];
  while (txStmt.step()) {
    const row = txStmt.getAsObject();
    transactions.push({
      ...row,
      receipt: Boolean(row.receipt),
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags || []
    });
  }
  txStmt.free();

  // Tags
  const tagStmt = database.prepare(`SELECT name, createdAt FROM tags ORDER BY name ASC`);
  const tags: any[] = [];
  while (tagStmt.step()) {
    tags.push(tagStmt.getAsObject());
  }
  tagStmt.free();

  // Rules
  const ruleStmt = database.prepare(`SELECT id, whenText, thenText, enabled, createdAt FROM rules ORDER BY createdAt DESC`);
  const rules: any[] = [];
  while (ruleStmt.step()) {
    const row = ruleStmt.getAsObject();
    rules.push({
      ...row,
      enabled: Boolean(row.enabled)
    });
  }
  ruleStmt.free();

  // Settings
  const settingsStmt = database.prepare(`SELECT key, value FROM settings`);
  const settings: Record<string, any> = {};
  while (settingsStmt.step()) {
    const row = settingsStmt.getAsObject() as { key: string; value: string };
    try {
      settings[row.key] = JSON.parse(row.value);
    } catch {
      settings[row.key] = row.value;
    }
  }
  settingsStmt.free();

  // Documents (up to 100, newest first)
  const docStmt = database.prepare(`
    SELECT id, filename, mimeType, size, objectKey, status, source, createdAt
    FROM documents
    ORDER BY createdAt DESC
    LIMIT 100
  `);
  const documents: any[] = [];
  while (docStmt.step()) {
    documents.push(docStmt.getAsObject());
  }
  docStmt.free();

  return {
    transactions,
    tags,
    rules,
    settings,
    documents
  };
}

export async function insertTransactionsBatch(rawItems: TransactionInput[]) {
  const database = await getDb();

  // Load enabled rules
  const ruleStmt = database.prepare(`SELECT id, whenText, thenText, enabled, createdAt FROM rules WHERE enabled = 1`);
  const rules: RuleRow[] = [];
  while (ruleStmt.step()) {
    rules.push(ruleStmt.getAsObject() as any);
  }
  ruleStmt.free();

  let insertedCount = 0;
  let duplicateCount = 0;
  let skippedCount = 0;
  let needsReviewCount = 0;
  const insertedRows: any[] = [];

  for (const raw of rawItems) {
    if (!raw.merchant || !raw.date || isNaN(Number(raw.amount)) || Number(raw.amount) <= 0) {
      skippedCount++;
      continue;
    }

    const type = raw.type === 'income' ? 'income' : 'expense';
    const amount = Math.abs(Number(raw.amount));
    const merchant = raw.merchant.trim();
    const date = raw.date.trim();
    const account = (raw.account || 'Imported account').trim();
    const source = (raw.source || 'manual').trim();
    const receipt = raw.receipt ? 1 : 0;

    // Build fingerprint
    const fingerprint = computeFingerprint(date, merchant, amount, account);

    // Pre-check duplicate in DB
    const checkStmt = database.prepare('SELECT id FROM transactions WHERE fingerprint = :fp');
    checkStmt.bind({ ':fp': fingerprint });
    const exists = checkStmt.step();
    checkStmt.free();

    if (exists) {
      duplicateCount++;
      continue;
    }

    // Apply enabled rules
    const rawTags = Array.isArray(raw.tags) ? raw.tags : [];
    const normalizedRawTags = Array.from(new Set(rawTags.map(t => t.trim()).filter(Boolean)));
    const { category, tags } = applyRulesToTransaction({
      merchant,
      category: raw.category || 'Needs review',
      tags: normalizedRawTags,
      source
    }, rules);

    if (category === 'Needs review') {
      needsReviewCount++;
    }

    const id = raw.id || crypto.randomUUID();
    const createdAt = new Date().toISOString();

    const insertStmt = database.prepare(`
      INSERT INTO transactions (id, date, merchant, category, amount, type, account, tags, receipt, source, fingerprint, createdAt)
      VALUES (:id, :date, :merchant, :category, :amount, :type, :account, :tags, :receipt, :source, :fingerprint, :createdAt)
    `);

    insertStmt.run({
      ':id': id,
      ':date': date,
      ':merchant': merchant,
      ':category': category,
      ':amount': amount,
      ':type': type,
      ':account': account,
      ':tags': JSON.stringify(tags),
      ':receipt': receipt,
      ':source': source,
      ':fingerprint': fingerprint,
      ':createdAt': createdAt
    });
    insertStmt.free();

    // Auto add any new tags to tags table
    for (const tagName of tags) {
      const tagCheck = database.prepare('SELECT name FROM tags WHERE name = :name');
      tagCheck.bind({ ':name': tagName });
      const hasTag = tagCheck.step();
      tagCheck.free();
      if (!hasTag) {
        const tagInsert = database.prepare('INSERT INTO tags (name, createdAt) VALUES (:name, :createdAt)');
        tagInsert.run({ ':name': tagName, ':createdAt': createdAt });
        tagInsert.free();
      }
    }

    insertedCount++;
    insertedRows.push({
      id,
      date,
      merchant,
      category,
      amount,
      type,
      account,
      tags,
      receipt: Boolean(receipt),
      source,
      fingerprint,
      createdAt
    });
  }

  saveDbToDisk();

  return {
    inserted: insertedCount,
    duplicates: duplicateCount,
    skipped: skippedCount,
    needsReview: needsReviewCount,
    transactions: insertedRows
  };
}

export async function patchTransaction(id: string, updates: { category?: string; tags?: string[] }) {
  const database = await getDb();

  const stmt = database.prepare('SELECT * FROM transactions WHERE id = :id');
  stmt.bind({ ':id': id });
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const row = stmt.getAsObject() as any;
  stmt.free();

  let category = row.category;
  let tags = typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags;

  if (updates.category !== undefined) {
    category = updates.category.trim() || 'Needs review';
  }

  if (updates.tags !== undefined) {
    const rawTags = Array.isArray(updates.tags) ? updates.tags : [];
    tags = Array.from(new Set(rawTags.map((t: string) => t.trim()).filter(Boolean)));

    // Ensure tags are in global tags table
    for (const t of tags) {
      const tagCheck = database.prepare('SELECT name FROM tags WHERE name = :name');
      tagCheck.bind({ ':name': t });
      if (!tagCheck.step()) {
        const tagInsert = database.prepare('INSERT INTO tags (name, createdAt) VALUES (:name, :createdAt)');
        tagInsert.run({ ':name': t, ':createdAt': new Date().toISOString() });
        tagInsert.free();
      }
      tagCheck.free();
    }
  }

  const updateStmt = database.prepare(`
    UPDATE transactions
    SET category = :category, tags = :tags
    WHERE id = :id
  `);
  updateStmt.run({
    ':id': id,
    ':category': category,
    ':tags': JSON.stringify(tags)
  });
  updateStmt.free();

  saveDbToDisk();

  return {
    ...row,
    category,
    tags,
    receipt: Boolean(row.receipt)
  };
}

export async function deleteTransactionById(id: string) {
  const database = await getDb();
  const stmt = database.prepare('DELETE FROM transactions WHERE id = :id');
  stmt.run({ ':id': id });
  stmt.free();
  saveDbToDisk();
  return true;
}

export async function savePreferences(prefs: Record<string, any>) {
  const database = await getDb();
  const now = new Date().toISOString();

  for (const [key, value] of Object.entries(prefs)) {
    if (key === 'tags' && Array.isArray(value)) {
      // Synchronize tags table
      database.run('DELETE FROM tags');
      for (const t of value) {
        const tagName = typeof t === 'string' ? t.trim() : t.name?.trim();
        if (tagName) {
          const insertTag = database.prepare('INSERT OR REPLACE INTO tags (name, createdAt) VALUES (:name, :createdAt)');
          insertTag.run({ ':name': tagName, ':createdAt': now });
          insertTag.free();
        }
      }
    } else if (key === 'rules' && Array.isArray(value)) {
      // Synchronize rules table
      database.run('DELETE FROM rules');
      for (const r of value) {
        if (r.whenText && r.thenText) {
          const insertRule = database.prepare(`
            INSERT INTO rules (id, whenText, thenText, enabled, createdAt)
            VALUES (:id, :whenText, :thenText, :enabled, :createdAt)
          `);
          insertRule.run({
            ':id': r.id || crypto.randomUUID(),
            ':whenText': r.whenText,
            ':thenText': r.thenText,
            ':enabled': r.enabled ? 1 : 0,
            ':createdAt': r.createdAt || now
          });
          insertRule.free();
        }
      }
    } else {
      // Store in settings table
      const upsert = database.prepare(`
        INSERT INTO settings (key, value, updatedAt)
        VALUES (:key, :value, :updatedAt)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt
      `);
      upsert.run({
        ':key': key,
        ':value': typeof value === 'string' ? value : JSON.stringify(value),
        ':updatedAt': now
      });
      upsert.free();
    }
  }

  saveDbToDisk();
  return { success: true };
}

export async function insertDocumentRecord(doc: {
  id?: string;
  filename: string;
  mimeType: string;
  size: number;
  objectKey: string;
  status: 'queued' | 'stored' | 'review';
  source: string;
}) {
  const database = await getDb();
  const id = doc.id || crypto.randomUUID();
  const createdAt = new Date().toISOString();

  const stmt = database.prepare(`
    INSERT INTO documents (id, filename, mimeType, size, objectKey, status, source, createdAt)
    VALUES (:id, :filename, :mimeType, :size, :objectKey, :status, :source, :createdAt)
  `);
  stmt.run({
    ':id': id,
    ':filename': doc.filename,
    ':mimeType': doc.mimeType,
    ':size': doc.size,
    ':objectKey': doc.objectKey,
    ':status': doc.status,
    ':source': doc.source,
    ':createdAt': createdAt
  });
  stmt.free();

  saveDbToDisk();

  return {
    id,
    filename: doc.filename,
    mimeType: doc.mimeType,
    size: doc.size,
    objectKey: doc.objectKey,
    status: doc.status,
    source: doc.source,
    createdAt
  };
}

export async function deleteDocumentRecord(id: string) {
  const database = await getDb();
  const stmt = database.prepare('SELECT objectKey FROM documents WHERE id = :id');
  stmt.bind({ ':id': id });
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const { objectKey } = stmt.getAsObject() as { objectKey: string };
  stmt.free();

  const delStmt = database.prepare('DELETE FROM documents WHERE id = :id');
  delStmt.run({ ':id': id });
  delStmt.free();

  saveDbToDisk();
  return objectKey;
}

export async function wipeAllData() {
  const database = await getDb();

  // Wipe tables
  database.run('DELETE FROM transactions');
  database.run('DELETE FROM documents');
  database.run('DELETE FROM rules');
  database.run('DELETE FROM tags');
  database.run('DELETE FROM settings');

  // Recreate structural empty-state defaults
  initSchema(database);

  // Set freshStart = true, driveResetAt = current ISO, assets = 0, liabilities = 0, netWorthConfigured = false, selectedPeriod = 'all-time'
  const now = new Date().toISOString();
  const updateSetting = (key: string, value: any) => {
    const upsert = database.prepare(`
      INSERT INTO settings (key, value, updatedAt)
      VALUES (:key, :value, :updatedAt)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt
    `);
    upsert.run({
      ':key': key,
      ':value': typeof value === 'string' ? value : JSON.stringify(value),
      ':updatedAt': now
    });
    upsert.free();
  };

  updateSetting('freshStart', true);
  updateSetting('driveResetAt', now);
  updateSetting('assets', 0);
  updateSetting('liabilities', 0);
  updateSetting('netWorthConfigured', false);
  updateSetting('selectedPeriod', 'all-time');
  updateSetting('goals', []);
  updateSetting('budgets', []);
  updateSetting('subscriptions', []);
  updateSetting('recurring', []);
  updateSetting('dismissedPatterns', []);
  updateSetting('processedFileIds', []);

  saveDbToDisk();

  // Wipe R2 bucket
  wipeAllBucketObjects();

  return { success: true, wipedAt: now };
}

export async function getDriveSyncInfo() {
  const database = await getDb();
  const getVal = (key: string, def: any) => {
    const stmt = database.prepare('SELECT value FROM settings WHERE key = :key');
    stmt.bind({ ':key': key });
    if (stmt.step()) {
      const val = (stmt.getAsObject() as any).value;
      stmt.free();
      try { return JSON.parse(val); } catch { return val; }
    }
    stmt.free();
    return def;
  };

  const folder = getVal('driveFolder', { name: 'Ledgerly Financial Inbox', id: '', url: '' });
  const sync = getVal('driveSync', {});
  const processedFileIds = getVal('processedFileIds', []).slice(-5000);
  const resetAt = getVal('driveResetAt', null);

  return {
    folder,
    schedule: { time: '08:00', timezone: 'America/Los_Angeles', cadence: 'daily' },
    lastSyncedAt: sync.lastSyncedAt || null,
    status: sync.status || 'idle',
    counts: {
      imported: sync.imported || 0,
      duplicates: sync.duplicates || 0,
      stored: sync.stored || 0,
      review: sync.review || 0,
      errors: sync.errors || []
    },
    processedFileIds,
    resetAt
  };
}
