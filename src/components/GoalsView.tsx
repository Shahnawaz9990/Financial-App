import React, { useState } from 'react';
import { Target, Plus, Edit2, Trash2, Calendar, CheckCircle, Sparkles } from 'lucide-react';
import { AppState, GoalItem } from '../types';

interface GoalsViewProps {
  state: AppState;
  onUpdateGoals: (goals: GoalItem[]) => Promise<void>;
}

export const GoalsView: React.FC<GoalsViewProps> = ({ state, onUpdateGoals }) => {
  const { settings } = state;
  const { goals = [] } = settings;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalItem | null>(null);
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalSaved = goals.reduce((sum, g) => sum + g.currentAmount, 0);
  const overallPct = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

  const handleOpenAdd = () => {
    setEditingGoal(null);
    setName('');
    setTargetAmount('');
    setCurrentAmount('0');
    setDueDate('');
    setNote('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (g: GoalItem) => {
    setEditingGoal(g);
    setName(g.name);
    setTargetAmount(g.targetAmount.toString());
    setCurrentAmount(g.currentAmount.toString());
    setDueDate(g.dueDate || '');
    setNote(g.note || '');
    setIsModalOpen(true);
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isNaN(Number(targetAmount)) || Number(targetAmount) <= 0) return;

    setIsSaving(true);
    try {
      const parsedTarget = Math.abs(Number(targetAmount));
      const parsedCurrent = Math.max(0, Number(currentAmount) || 0);

      let updated: GoalItem[];
      if (editingGoal) {
        updated = goals.map((g) =>
          g.id === editingGoal.id
            ? {
                ...g,
                name: name.trim(),
                targetAmount: parsedTarget,
                currentAmount: parsedCurrent,
                dueDate: dueDate || undefined,
                note: note.trim() || undefined
              }
            : g
        );
      } else {
        const newGoal: GoalItem = {
          id: crypto.randomUUID(),
          name: name.trim(),
          targetAmount: parsedTarget,
          currentAmount: parsedCurrent,
          dueDate: dueDate || undefined,
          note: note.trim() || undefined,
          createdAt: new Date().toISOString()
        };
        updated = [...goals, newGoal];
      }

      await onUpdateGoals(updated);
      setIsModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this savings goal?')) return;
    const updated = goals.filter((g) => g.id !== id);
    await onUpdateGoals(updated);
  };

  return (
    <div id="goals-view" className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Savings Goals</h2>
          <p className="text-sm text-slate-500">
            Set and monitor financial targets like emergency funds, travel, or major investments
          </p>
        </div>

        <button
          id="create-goal-btn"
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#6558D3] hover:bg-[#574abf] text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Create goal
        </button>
      </div>

      {/* Overview Metric Card */}
      {goals.length > 0 && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Goal Progress
              </span>
              <div className="text-3xl font-bold tracking-tight text-slate-900 mt-1">
                ${totalSaved.toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
                <span className="text-slate-400 text-lg font-normal">
                  / ${totalTarget.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="bg-violet-50 text-[#6558D3] border border-violet-100 px-4 py-2 rounded-xl text-center">
              <div className="text-xs font-medium">Overall Progress</div>
              <div className="text-xl font-bold">{overallPct.toFixed(1)}%</div>
            </div>
          </div>

          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mt-4">
            <div
              style={{ width: `${Math.min(100, overallPct)}%` }}
              className="bg-[#6558D3] h-full rounded-full transition-all"
            />
          </div>
        </div>
      )}

      {/* Goals Cards Grid */}
      {goals.length === 0 ? (
        <div className="bg-white border border-slate-200/90 rounded-2xl py-16 px-4 text-center shadow-2xs">
          <Target className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-700">No goals created yet</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Create goals with target amounts and timelines to keep your savings purposeful.
          </p>
          <button
            onClick={handleOpenAdd}
            className="mt-4 px-4 py-2 bg-[#6558D3] hover:bg-[#574abf] text-white text-xs font-semibold rounded-xl shadow-xs"
          >
            Create your first goal
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {goals.map((g) => {
            const remaining = Math.max(0, g.targetAmount - g.currentAmount);
            const pct = g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 0;
            const isCompleted = g.currentAmount >= g.targetAmount;

            return (
              <div
                key={g.id}
                className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-base">{g.name}</h4>
                      {g.dueDate && (
                        <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3" /> Target: {g.dueDate}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(g)}
                        className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100"
                        title="Edit goal"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(g.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50"
                        title="Delete goal"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {g.note && <p className="text-xs text-slate-500 mt-2 line-clamp-2">{g.note}</p>}

                  <div className="my-4">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="font-bold text-slate-900 text-lg">
                        ${g.currentAmount.toLocaleString()}
                      </span>
                      <span className="text-slate-400">of ${g.targetAmount.toLocaleString()}</span>
                    </div>

                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-1.5">
                      <div
                        style={{ width: `${Math.min(100, pct)}%` }}
                        className={`h-full rounded-full transition-all ${
                          isCompleted ? 'bg-emerald-500' : 'bg-[#6558D3]'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  {isCompleted ? (
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Goal reached!
                    </span>
                  ) : (
                    <span className="text-slate-600">${remaining.toLocaleString()} left to save</span>
                  )}
                  <span className="text-slate-400 font-medium">{pct.toFixed(0)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Goal Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="font-bold text-slate-900 text-base mb-4">
              {editingGoal ? 'Edit Savings Goal' : 'Create Savings Goal'}
            </h3>

            <form onSubmit={handleSaveModal} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Goal Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Emergency Fund, New Laptop, Japan Trip"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Target Amount ($)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    required
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    placeholder="5000"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Current Saved ($)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={currentAmount}
                    onChange={(e) => setCurrentAmount(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Target Due Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Note (Optional)</label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Account / Milestone"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-[#6558D3] hover:bg-[#574abf] text-white text-xs font-semibold rounded-xl shadow-xs"
                >
                  {isSaving ? 'Saving...' : 'Save Goal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
