import React, { useState } from 'react';
import { X, Plus, Tag, Check } from 'lucide-react';
import { TagItem, Transaction } from '../types';

interface TagModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  allTags: TagItem[];
  onSaveTags: (transactionId: string, updatedTags: string[]) => Promise<void>;
}

export const TagModal: React.FC<TagModalProps> = ({
  isOpen,
  onClose,
  transaction,
  allTags,
  onSaveTags
}) => {
  if (!isOpen || !transaction) return null;

  const [selectedTags, setSelectedTags] = useState<string[]>(transaction.tags || []);
  const [newTagName, setNewTagName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTag = (tagName: string) => {
    if (selectedTags.includes(tagName)) {
      setSelectedTags(selectedTags.filter((t) => t !== tagName));
    } else {
      setSelectedTags([...selectedTags, tagName]);
    }
  };

  const handleAddNewTag = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTagName.trim();
    if (!trimmed) return;
    if (!selectedTags.includes(trimmed)) {
      setSelectedTags([...selectedTags, trimmed]);
    }
    setNewTagName('');
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onSaveTags(transaction.id, selectedTags);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save tags');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        id="tag-editor-modal"
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-[#6558D3]" />
            <h3 className="font-bold text-slate-900 text-base">Edit Transaction Tags</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-4">
          <div className="text-xs text-slate-500">
            Editing tags for <span className="font-semibold text-slate-800">{transaction.merchant}</span> ({transaction.date})
          </div>

          {/* Quick Add Tag Form */}
          <form onSubmit={handleAddNewTag} className="flex gap-2">
            <input
              type="text"
              id="new-tag-input"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="Type a new tag name..."
              className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
            />
            <button
              type="submit"
              disabled={!newTagName.trim()}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold flex items-center gap-1 disabled:opacity-50 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </form>

          {/* Tag Selector Grid */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-2">
              Available &amp; Selected Tags:
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-1">
              {allTags.length === 0 && selectedTags.length === 0 ? (
                <div className="text-xs text-slate-400 italic">No tags created yet. Type one above!</div>
              ) : (
                // Unique list of allTags + any newly typed in selectedTags
                Array.from(new Set([...allTags.map((t) => t.name), ...selectedTags])).map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-[#6558D3] text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                      <span>{tag}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {error && (
            <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
              {error}
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-[#6558D3] hover:bg-[#574abf] text-white text-xs font-semibold rounded-xl shadow-xs disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Apply Tags'}
          </button>
        </div>
      </div>
    </div>
  );
};
