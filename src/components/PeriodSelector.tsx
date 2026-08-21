import React from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { DatePeriod, Transaction } from '../types';

export const PERIOD_OPTIONS: { id: DatePeriod; label: string }[] = [
  { id: 'all-time', label: 'All time' },
  { id: 'this-month', label: 'This month' },
  { id: 'last-month', label: 'Last month' },
  { id: 'last-3-months', label: 'Last 3 months' },
  { id: 'last-6-months', label: 'Last 6 months' },
  { id: 'this-year', label: 'This year' }
];

export function getPeriodDateRange(period: DatePeriod): { startDate: string | null; endDate: string | null } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  if (period === 'all-time') {
    return { startDate: null, endDate: null };
  }

  if (period === 'this-month') {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    };
  }

  if (period === 'last-month') {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    };
  }

  if (period === 'last-3-months') {
    const start = new Date(year, month - 2, 1);
    const end = new Date(year, month + 1, 0);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    };
  }

  if (period === 'last-6-months') {
    const start = new Date(year, month - 5, 1);
    const end = new Date(year, month + 1, 0);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    };
  }

  if (period === 'this-year') {
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    };
  }

  return { startDate: null, endDate: null };
}

export function filterTransactionsByPeriod(transactions: Transaction[], period: DatePeriod): Transaction[] {
  if (period === 'all-time') return transactions;
  const { startDate, endDate } = getPeriodDateRange(period);
  if (!startDate || !endDate) return transactions;

  return transactions.filter((t) => {
    return t.date >= startDate && t.date <= endDate;
  });
}

interface PeriodSelectorProps {
  selectedPeriod: DatePeriod;
  onSelectPeriod: (period: DatePeriod) => void;
  isLoading?: boolean;
}

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({
  selectedPeriod,
  onSelectPeriod,
  isLoading
}) => {
  return (
    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-2xs">
      <div className="hidden sm:flex items-center pl-2 pr-1 text-slate-400">
        <Calendar className="w-4 h-4 text-[#6558D3]" />
      </div>

      <div className="flex flex-wrap gap-1">
        {PERIOD_OPTIONS.map((opt) => {
          const isSelected = selectedPeriod === opt.id;
          return (
            <button
              key={opt.id}
              id={`period-btn-${opt.id}`}
              onClick={() => onSelectPeriod(opt.id)}
              disabled={isLoading}
              className={`px-2.5 py-1 text-xs md:text-sm font-medium rounded-lg transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#6558D3] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
