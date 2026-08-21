import { Transaction, DetectedPattern, Cadence } from '../types';

const SUBSCRIPTION_HINTS = [
  'netflix', 'spotify', 'hulu', 'disney', 'youtube', 'icloud', 'dropbox',
  'adobe', 'microsoft', 'amazon prime', 'patreon', 'membership', 'studio',
  'gym', 'openai', 'chatgpt', 'canva', 'notion', 'zoom', 'slack', 'github'
];

const RECURRING_HINTS = [
  'mortgage', 'rent', 'loan', 'insurance', 'utility', 'utilities', 'electric',
  'water', 'internet', 'phone', 'mobile', 'daycare', 'tuition', 'lease',
  'car payment', 'auto payment', 'hoa', 'property tax'
];

export function normalizeMerchant(merchant: string): string {
  if (!merchant) return '';
  return merchant
    .toLowerCase()
    .trim()
    .replace(/[#*][0-9]+/g, '') // remove terminal #1234 or *1234
    .replace(/\b\d{6,}\b/g, '') // remove long reference numbers
    .replace(/[^\w\s]/g, ' ') // remove punctuation
    .replace(/\s+/g, ' ') // collapse whitespace
    .trim();
}

export function detectPatterns(
  transactions: Transaction[],
  dismissedKeys: string[] = [],
  confirmedSubNames: string[] = [],
  confirmedRecNames: string[] = []
): {
  subscriptions: DetectedPattern[];
  recurring: DetectedPattern[];
} {
  const dismissedSet = new Set(dismissedKeys);
  const confirmedSubSet = new Set(confirmedSubNames.map(s => normalizeMerchant(s)));
  const confirmedRecSet = new Set(confirmedRecNames.map(r => normalizeMerchant(r)));

  // Filter only expense transactions
  const expenses = transactions.filter(t => t.type === 'expense');

  // Group by normalized merchant
  const groups: Record<string, { original: string; txs: Transaction[] }> = {};
  for (const tx of expenses) {
    const norm = normalizeMerchant(tx.merchant);
    if (!norm) continue;
    if (!groups[norm]) {
      groups[norm] = { original: tx.merchant, txs: [] };
    }
    groups[norm].txs.push(tx);
  }

  const subscriptions: DetectedPattern[] = [];
  const recurring: DetectedPattern[] = [];

  for (const [normKey, { original, txs }] of Object.entries(groups)) {
    // Check if dismissed
    if (dismissedSet.has(normKey)) continue;

    // Deduplicate by unique dates
    const dateMap = new Map<string, Transaction>();
    for (const t of txs) {
      if (!dateMap.has(t.date)) {
        dateMap.set(t.date, t);
      }
    }

    const uniqueDates = Array.from(dateMap.keys()).sort();
    if (uniqueDates.length < 2) continue; // Require at least 2 unique dates

    // Calculate consecutive day intervals
    const intervals: number[] = [];
    for (let i = 1; i < uniqueDates.length; i++) {
      const prevTime = new Date(uniqueDates[i - 1]).getTime();
      const currTime = new Date(uniqueDates[i]).getTime();
      const daysDiff = Math.round((currTime - prevTime) / (1000 * 60 * 60 * 24));
      if (daysDiff > 0) {
        intervals.push(daysDiff);
      }
    }

    if (intervals.length === 0) continue;

    // Determine dominant interval / cadence
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    let cadence: Cadence | null = null;

    if (avgInterval >= 5 && avgInterval <= 9) {
      cadence = 'weekly';
    } else if (avgInterval >= 12 && avgInterval <= 17) {
      cadence = 'biweekly';
    } else if (avgInterval >= 24 && avgInterval <= 40) {
      cadence = 'monthly';
    } else if (avgInterval >= 75 && avgInterval <= 110) {
      cadence = 'quarterly';
    } else if (avgInterval >= 330 && avgInterval <= 400) {
      cadence = 'annual';
    }

    if (!cadence) continue; // Reject if interval doesn't fit any valid cadence window

    // Amount variation check
    const amounts = uniqueDates.map(d => dateMap.get(d)!.amount);
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const maxDev = Math.max(...amounts.map(a => Math.abs(a - avgAmount)));
    const variationPercent = (maxDev / (avgAmount || 1)) * 100;

    // Jitter in days
    const intervalDevs = intervals.map(i => Math.abs(i - avgInterval));
    const maxJitter = Math.max(...intervalDevs);

    // Hints
    const allTags = txs.flatMap(t => t.tags).map(t => t.toLowerCase());
    const category = txs[txs.length - 1].category || 'Needs review';
    const isCategorySub = category.toLowerCase().includes('subscription') || allTags.some(t => t.includes('subscription'));
    const isCategoryRec = category.toLowerCase().includes('utility') || category.toLowerCase().includes('housing') || category.toLowerCase().includes('bill');

    const hasSubHint = isCategorySub || SUBSCRIPTION_HINTS.some(h => normKey.includes(h));
    const hasRecHint = isCategoryRec || RECURRING_HINTS.some(h => normKey.includes(h));

    let kind: 'subscription' | 'recurring' = hasSubHint ? 'subscription' : 'recurring';

    // Amount variation limit checks
    if (kind === 'subscription' && variationPercent > 20) {
      continue;
    }
    if (kind === 'recurring' && variationPercent > 35) {
      continue;
    }

    // Protection against false positives (Section 9.5)
    // If no strong hint, requires at least 3 occurrences in monthly, quarterly, or annual and variation <= 3%
    if (!hasSubHint && !hasRecHint) {
      if (uniqueDates.length < 3) continue;
      if (cadence !== 'monthly' && cadence !== 'quarterly' && cadence !== 'annual') continue;
      if (variationPercent > 3) continue;
    }

    // Confidence calculation (Section 9.6)
    const isHighConfidence = uniqueDates.length >= 3 && variationPercent <= 12 && maxJitter <= 5;
    const confidence: 'high' | 'likely' = isHighConfidence ? 'high' : 'likely';

    // Monthly equivalent calculation (Section 9.6)
    let monthlyEquivalent = avgAmount;
    if (cadence === 'weekly') {
      monthlyEquivalent = (avgAmount * 52) / 12;
    } else if (cadence === 'biweekly') {
      monthlyEquivalent = (avgAmount * 26) / 12;
    } else if (cadence === 'monthly') {
      monthlyEquivalent = avgAmount;
    } else if (cadence === 'quarterly') {
      monthlyEquivalent = avgAmount / 3;
    } else if (cadence === 'annual') {
      monthlyEquivalent = avgAmount / 12;
    }

    // Calculate calendar-aware next date
    const lastDateStr = uniqueDates[uniqueDates.length - 1];
    const lastDate = new Date(lastDateStr);
    const nextD = new Date(lastDate);

    if (cadence === 'weekly') {
      nextD.setDate(nextD.getDate() + 7);
    } else if (cadence === 'biweekly') {
      nextD.setDate(nextD.getDate() + 14);
    } else if (cadence === 'monthly') {
      nextD.setMonth(nextD.getMonth() + 1);
    } else if (cadence === 'quarterly') {
      nextD.setMonth(nextD.getMonth() + 3);
    } else if (cadence === 'annual') {
      nextD.setFullYear(nextD.getFullYear() + 1);
    }

    const nextDateIso = nextD.toISOString().split('T')[0];

    const pattern: DetectedPattern = {
      key: normKey,
      merchant: normKey,
      originalMerchant: original,
      category,
      kind,
      cadence,
      occurrences: uniqueDates.length,
      confidence,
      averageAmount: avgAmount,
      monthlyEquivalent,
      nextDate: nextDateIso,
      account: txs[txs.length - 1].account
    };

    if (kind === 'subscription') {
      if (!confirmedSubSet.has(normKey)) {
        subscriptions.push(pattern);
      }
    } else {
      if (!confirmedRecSet.has(normKey)) {
        recurring.push(pattern);
      }
    }
  }

  return {
    subscriptions,
    recurring
  };
}
