export type DatePeriod =
  | 'all-time'
  | 'this-month'
  | 'last-month'
  | 'last-3-months'
  | 'last-6-months'
  | 'this-year';

export type NavTab =
  | 'dashboard'
  | 'transactions'
  | 'recurring'
  | 'subscriptions'
  | 'budgets'
  | 'goals'
  | 'documents'
  | 'rules'
  | 'settings';

export interface Transaction {
  id: string;
  date: string; // ISO YYYY-MM-DD
  merchant: string;
  category: string;
  amount: number; // positive magnitude
  type: 'expense' | 'income';
  account: string;
  tags: string[];
  receipt: boolean;
  source: 'manual' | 'csv' | 'document' | 'google-drive' | string;
  fingerprint: string;
  createdAt: string;
}

export interface TagItem {
  name: string;
  createdAt: string;
}

export interface RuleItem {
  id: string;
  whenText: string;
  thenText: string;
  enabled: boolean;
  createdAt: string;
}

export interface DocumentItem {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  objectKey: string;
  status: 'queued' | 'stored' | 'review';
  source: 'upload' | 'google-drive' | string;
  createdAt: string;
}

export interface GoalItem {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  dueDate?: string;
  note?: string;
  createdAt?: string;
}

export interface BudgetItem {
  id: string;
  category: string;
  limit: number;
  active: boolean;
}

export type Cadence = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual';

export interface SubscriptionItem {
  id: string;
  name: string;
  category: string;
  amount: number;
  cadence: Cadence;
  nextRenewal: string; // YYYY-MM-DD
  account?: string;
  active: boolean;
}

export interface RecurringPaymentItem {
  id: string;
  name: string;
  category: string;
  amount: number;
  cadence: Cadence;
  nextDate: string; // YYYY-MM-DD
  account?: string;
  active: boolean;
}

export interface DriveFolderInfo {
  name: string;
  id: string;
  url: string;
}

export interface DriveSyncStats {
  lastSyncedAt: string | null;
  status: 'idle' | 'complete' | 'partial' | 'error';
  imported: number;
  duplicates: number;
  stored: number;
  review: number;
  errors: string[];
}

export interface AppSettings {
  categories: string[];
  accounts: string[];
  goals: GoalItem[];
  budgets: BudgetItem[];
  subscriptions: SubscriptionItem[];
  recurring: RecurringPaymentItem[];
  dismissedPatterns: string[];
  selectedPeriod: DatePeriod;
  assets: number;
  liabilities: number;
  netWorthConfigured: boolean;
  freshStart: boolean;
  driveFolder: DriveFolderInfo;
  driveSync: DriveSyncStats;
  processedFileIds: string[];
  driveResetAt: string | null;
}

export interface AppState {
  transactions: Transaction[];
  tags: TagItem[];
  rules: RuleItem[];
  settings: AppSettings;
  documents: DocumentItem[];
}

export interface DetectedPattern {
  key: string;
  merchant: string;
  originalMerchant: string;
  category: string;
  kind: 'subscription' | 'recurring';
  cadence: Cadence;
  occurrences: number;
  confidence: 'high' | 'likely';
  averageAmount: number;
  monthlyEquivalent: number;
  nextDate: string;
  account?: string;
}
