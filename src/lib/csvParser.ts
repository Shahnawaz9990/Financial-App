import { Transaction } from '../types';

export interface CsvPreview {
  headers: string[];
  rows: string[][];
  totalRows: number;
  detectedMapping: {
    dateIdx: number;
    merchantIdx: number;
    amountIdx: number;
    debitIdx: number;
    creditIdx: number;
    categoryIdx: number;
    accountIdx: number;
  };
}

export interface ParsedStatementResult {
  headers: string[];
  rows: Partial<Transaction>[];
  duplicateCount: number;
}

export function parseCsvString(csvText: string): string[][] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const rows: string[][] = [];

  for (const line of lines) {
    const row: string[] = [];
    let insideQuotes = false;
    let currentVal = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (insideQuotes && line[i + 1] === '"') {
          currentVal += '"';
          i++; // skip next escaped quote
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        row.push(currentVal.trim());
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
    row.push(currentVal.trim());
    rows.push(row);
  }

  return rows;
}

export function analyzeCsv(csvText: string): CsvPreview | null {
  const parsedRows = parseCsvString(csvText);
  if (parsedRows.length < 2) return null;

  const headers = parsedRows[0].map((h) => h.toLowerCase().trim());
  const rows = parsedRows.slice(1);

  let dateIdx = headers.findIndex(
    (h) => h.includes('date') || h === 'post date' || h === 'trans date' || h === 'posting date'
  );
  let merchantIdx = headers.findIndex(
    (h) =>
      h.includes('desc') ||
      h.includes('merchant') ||
      h.includes('payee') ||
      h.includes('name') ||
      h.includes('memo') ||
      h.includes('narrative')
  );
  let amountIdx = headers.findIndex(
    (h) =>
      (h.includes('amount') || h === 'total' || h === 'sum') &&
      !h.includes('debit') &&
      !h.includes('credit')
  );
  let debitIdx = headers.findIndex(
    (h) => h.includes('debit') || h.includes('withdrawal') || h.includes('out') || h.includes('charge')
  );
  let creditIdx = headers.findIndex(
    (h) => h.includes('credit') || h.includes('deposit') || h.includes('in') || h.includes('payment')
  );
  let categoryIdx = headers.findIndex(
    (h) => h.includes('cat') || h.includes('type') || h.includes('classification')
  );
  let accountIdx = headers.findIndex(
    (h) => h.includes('account') || h.includes('card') || h.includes('wallet')
  );

  return {
    headers: parsedRows[0],
    rows: rows.slice(0, 10),
    totalRows: rows.length,
    detectedMapping: {
      dateIdx,
      merchantIdx,
      amountIdx,
      debitIdx,
      creditIdx,
      categoryIdx,
      accountIdx
    }
  };
}

export function parseCsvRowsToTransactions(
  csvText: string,
  mapping: {
    dateIdx: number;
    merchantIdx: number;
    amountIdx: number;
    debitIdx: number;
    creditIdx: number;
    categoryIdx: number;
    accountIdx: number;
  },
  defaultAccount: string = 'Imported account'
): Partial<Transaction>[] {
  const parsedRows = parseCsvString(csvText);
  if (parsedRows.length < 2) return [];

  const rawDataRows = parsedRows.slice(1);
  const results: Partial<Transaction>[] = [];

  for (const row of rawDataRows) {
    const rawDate = row[mapping.dateIdx]?.trim();
    const rawMerchant = row[mapping.merchantIdx]?.trim();
    if (!rawDate || !rawMerchant) continue;

    // Normalize date to YYYY-MM-DD
    let normalizedDate: string = '';
    const parsedDate = new Date(rawDate);
    if (!isNaN(parsedDate.getTime())) {
      normalizedDate = parsedDate.toISOString().split('T')[0];
    } else {
      const parts = rawDate.split(/[-/.]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          normalizedDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        } else if (parts[2].length === 4) {
          normalizedDate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
        }
      }
    }

    if (!normalizedDate) continue;

    let amount = 0;
    let type: 'expense' | 'income' = 'expense';

    if (mapping.debitIdx >= 0 && row[mapping.debitIdx] && mapping.debitIdx !== mapping.amountIdx) {
      const debitVal = parseFloat(row[mapping.debitIdx].replace(/[^0-9.-]/g, ''));
      if (!isNaN(debitVal) && Math.abs(debitVal) > 0) {
        amount = Math.abs(debitVal);
        type = 'expense';
      }
    }

    if (mapping.creditIdx >= 0 && row[mapping.creditIdx] && mapping.creditIdx !== mapping.amountIdx) {
      const creditVal = parseFloat(row[mapping.creditIdx].replace(/[^0-9.-]/g, ''));
      if (!isNaN(creditVal) && Math.abs(creditVal) > 0) {
        amount = Math.abs(creditVal);
        type = 'income';
      }
    }

    if (amount === 0 && mapping.amountIdx >= 0 && row[mapping.amountIdx]) {
      const rawAmt = row[mapping.amountIdx].replace(/[$,]/g, '').trim();
      const isNeg = rawAmt.startsWith('-') || (rawAmt.startsWith('(') && rawAmt.endsWith(')'));
      const parsedAmt = parseFloat(rawAmt.replace(/[()]/g, ''));
      if (!isNaN(parsedAmt) && Math.abs(parsedAmt) > 0) {
        amount = Math.abs(parsedAmt);
        type = isNeg ? 'expense' : parsedAmt < 0 ? 'expense' : 'income';
      }
    }

    if (amount <= 0) continue;

    const rawCategory = mapping.categoryIdx >= 0 ? row[mapping.categoryIdx]?.trim() : '';
    const rawAccount = mapping.accountIdx >= 0 ? row[mapping.accountIdx]?.trim() : '';

    results.push({
      date: normalizedDate,
      merchant: rawMerchant,
      amount,
      type,
      category: rawCategory || 'Needs review',
      account: rawAccount || defaultAccount,
      tags: ['Statement Import'],
      receipt: false,
      source: 'csv'
    });
  }

  return results;
}

export function parseCsvStatement(
  csvText: string,
  defaultAccount: string,
  categories: string[] = []
): ParsedStatementResult {
  const analysis = analyzeCsv(csvText);
  if (!analysis) {
    throw new Error('Could not identify valid CSV table structure in uploaded file.');
  }

  const rows = parseCsvRowsToTransactions(csvText, analysis.detectedMapping, defaultAccount);

  return {
    headers: analysis.headers,
    rows,
    duplicateCount: 0
  };
}
