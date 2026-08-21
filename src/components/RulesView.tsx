import React, { useState } from 'react';
import {
  Sliders,
  Plus,
  Trash2,
  Edit2,
  Tag,
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { AppState, RuleItem, TagItem } from '../types';

interface RulesViewProps {
  state: AppState;
  onUpdateRules: (rules: RuleItem[]) => Promise<void>;
  onUpdateTags: (tags: TagItem[]) => Promise<void>;
}

export const RulesView: React.FC<RulesViewProps> = ({
  state,
  onUpdateRules,
  onUpdateTags
}) => {
  const { rules = [], tags = [], transactions, settings } = state;
  const { categories } = settings;

  // State for Rules
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RuleItem | null>(null);
  const [whenText, setWhenText] = useState('');
  const [thenText, setThenText] = useState('');
  const [isSavingRule, setIsSavingRule] = useState(false);

  // State for Tags
  const [newTagName, setNewTagName] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);

  // Count tag usages
  const tagCounts: Record<string, number> = {};
  for (const t of transactions) {
    for (const tag of t.tags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  // Handle Rule Actions
  const handleOpenAddRule = () => {
    setEditingRule(null);
    setWhenText('');
    setThenText(categories[0] || 'Groceries');
    setIsRuleModalOpen(true);
  };

  const handleOpenEditRule = (r: RuleItem) => {
    setEditingRule(r);
    setWhenText(r.whenText);
    setThenText(r.thenText);
    setIsRuleModalOpen(true);
  };

  const handleToggleRule = async (rule: RuleItem) => {
    const updated = rules.map((r) =>
      r.id === rule.id ? { ...r, enabled: !r.enabled } : r
    );
    await onUpdateRules(updated);
  };

  const handleDeleteRule = async (id: string) => {
    if (!window.confirm('Delete this rule?')) return;
    const updated = rules.filter((r) => r.id !== id);
    await onUpdateRules(updated);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whenText.trim() || !thenText.trim()) return;

    setIsSavingRule(true);
    try {
      let updated: RuleItem[];
      if (editingRule) {
        updated = rules.map((r) =>
          r.id === editingRule.id
            ? { ...r, whenText: whenText.trim(), thenText: thenText.trim() }
            : r
        );
      } else {
        const newRule: RuleItem = {
          id: crypto.randomUUID(),
          whenText: whenText.trim(),
          thenText: thenText.trim(),
          enabled: true,
          createdAt: new Date().toISOString()
        };
        updated = [...rules, newRule];
      }
      await onUpdateRules(updated);
      setIsRuleModalOpen(false);
    } finally {
      setIsSavingRule(false);
    }
  };

  // Handle Tag Actions
  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTagName.trim();
    if (!trimmed) return;

    if (tags.some((t) => t.name.toLowerCase() === trimmed.toLowerCase())) {
      setTagError(`Tag "${trimmed}" already exists.`);
      return;
    }

    setIsAddingTag(true);
    setTagError(null);
    try {
      const newTag: TagItem = { name: trimmed, createdAt: new Date().toISOString() };
      await onUpdateTags([...tags, newTag]);
      setNewTagName('');
    } catch (err: any) {
      setTagError(err.message || 'Failed to create tag');
    } finally {
      setIsAddingTag(false);
    }
  };

  const handleDeleteTag = async (tagName: string) => {
    if (!window.confirm(`Delete tag "${tagName}"?`)) return;
    const updated = tags.filter((t) => t.name !== tagName);
    await onUpdateTags(updated);
  };

  return (
    <div id="rules-view" className="space-y-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Rules &amp; Tag Manager</h2>
          <p className="text-sm text-slate-500">
            Automate merchant categorization and organize custom tags for granular filtering
          </p>
        </div>

        <button
          id="create-rule-btn"
          onClick={handleOpenAddRule}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#6558D3] hover:bg-[#574abf] text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Create rule
        </button>
      </div>

      {/* Categorization Rules Section */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Categorization Rules</h3>
            <p className="text-xs text-slate-500">
              Rules automatically categorize transactions when imported via CSV, upload, or Drive sync
            </p>
          </div>
          <span className="text-xs text-slate-500">{rules.length} rules active</span>
        </div>

        {rules.length === 0 ? (
          <div className="py-14 px-4 text-center bg-slate-50/50">
            <Sliders className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-slate-700">No categorization rules configured</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Create rules like "When merchant contains 'Costco' then set Category to Groceries".
            </p>
            <button
              onClick={handleOpenAddRule}
              className="mt-4 px-4 py-2 bg-[#6558D3] hover:bg-[#574abf] text-white text-xs font-semibold rounded-xl"
            >
              Add your first rule
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {rules.map((rule) => (
              <div key={rule.id} className="p-4 md:px-6 flex items-center justify-between gap-4 hover:bg-slate-50/60">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleToggleRule(rule)}
                    className="text-[#6558D3] hover:opacity-80 transition-opacity cursor-pointer"
                    title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                  >
                    {rule.enabled ? (
                      <ToggleRight className="w-7 h-7 text-[#6558D3]" />
                    ) : (
                      <ToggleLeft className="w-7 h-7 text-slate-400" />
                    )}
                  </button>

                  <div className="text-xs md:text-sm">
                    <div className="font-medium text-slate-900">
                      When merchant contains <span className="bg-slate-100 px-2 py-0.5 rounded font-mono font-semibold">"{rule.whenText}"</span>
                    </div>
                    <div className="text-slate-500 mt-0.5">
                      Then apply <span className="text-[#6558D3] font-semibold">{rule.thenText}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEditRule(rule)}
                    className="text-xs text-slate-500 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-100"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="text-slate-400 hover:text-rose-600 p-1.5 rounded hover:bg-rose-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tag Management Section */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Custom Tags</h3>
            <p className="text-xs text-slate-500">
              Manage all custom tags available in Ledgerly and view transaction counts
            </p>
          </div>

          {/* Quick Create Tag Form */}
          <form onSubmit={handleAddTag} className="flex gap-2">
            <input
              type="text"
              id="tag-name-input"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="Tag name (e.g. Tax Deductible)..."
              className="px-3 py-1.5 text-xs md:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
            />
            <button
              type="submit"
              disabled={isAddingTag || !newTagName.trim()}
              className="px-3 py-1.5 bg-[#6558D3] hover:bg-[#574abf] text-white text-xs font-semibold rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Create tag
            </button>
          </form>
        </div>

        {tagError && (
          <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
            {tagError}
          </div>
        )}

        {/* Tags Grid */}
        <div className="flex flex-wrap gap-2 pt-2">
          {tags.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No custom tags created yet.</p>
          ) : (
            tags.map((tag) => {
              const count = tagCounts[tag.name] || 0;
              return (
                <div
                  key={tag.name}
                  className="bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs transition-colors"
                >
                  <Tag className="w-3.5 h-3.5 text-[#6558D3]" />
                  <span className="font-medium text-slate-800">{tag.name}</span>
                  <span className="bg-slate-200/80 text-slate-600 px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                    {count}
                  </span>
                  <button
                    onClick={() => handleDeleteTag(tag.name)}
                    className="text-slate-400 hover:text-rose-600 ml-1 cursor-pointer"
                    title="Delete tag"
                  >
                    &times;
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Create / Edit Rule Modal */}
      {isRuleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="font-bold text-slate-900 text-base mb-4">
              {editingRule ? 'Edit Rule' : 'Create Categorization Rule'}
            </h3>

            <form onSubmit={handleSaveRule} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  When merchant contains (case-insensitive text)
                </label>
                <input
                  type="text"
                  required
                  value={whenText}
                  onChange={(e) => setWhenText(e.target.value)}
                  placeholder="e.g. Costco, Chevron, Uber, Starbucks"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Then apply (Category or Tag)
                </label>
                <div className="space-y-2">
                  <select
                    value={thenText}
                    onChange={(e) => setThenText(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
                  >
                    <optgroup label="Categories">
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          Category: {c}
                        </option>
                      ))}
                    </optgroup>
                    {tags.length > 0 && (
                      <optgroup label="Tags">
                        {tags.map((t) => (
                          <option key={t.name} value={`Tag: ${t.name}`}>
                            Tag: {t.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRuleModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingRule}
                  className="px-4 py-2 bg-[#6558D3] hover:bg-[#574abf] text-white text-xs font-semibold rounded-xl shadow-xs"
                >
                  {isSavingRule ? 'Saving...' : 'Save Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
