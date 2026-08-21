import React from 'react';
import { NavTab, NAV_ITEMS } from './Sidebar';
import { PlusCircle } from 'lucide-react';

interface MobileNavProps {
  currentTab?: NavTab;
  activeTab?: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenAddEntry?: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  currentTab,
  activeTab,
  onSelectTab,
  onOpenAddEntry
}) => {
  const selectedTab = currentTab || activeTab || 'dashboard';

  return (
    <nav
      id="mobile-bottom-nav"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#0F172A]/95 backdrop-blur-md border-t border-slate-800 px-2 py-1.5 shadow-lg"
    >
      {/* Horizontally scrollable bar */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1 px-1 scroll-smooth">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = selectedTab === item.id;
          return (
            <button
              key={item.id}
              id={`mobile-nav-${item.id}`}
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center justify-center min-w-[64px] py-1.5 px-2 rounded-xl transition-all shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-[#6558D3] text-white font-semibold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className={`w-4 h-4 mb-0.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span className="text-[10px] whitespace-nowrap tracking-tight">{item.label}</span>
            </button>
          );
        })}

        {onOpenAddEntry && (
          <button
            id="mobile-nav-add-btn"
            onClick={onOpenAddEntry}
            className="flex flex-col items-center justify-center min-w-[64px] py-1.5 px-2 rounded-xl text-emerald-400 hover:text-emerald-300 transition-colors shrink-0 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 mb-0.5 text-emerald-400" />
            <span className="text-[10px] whitespace-nowrap font-medium tracking-tight">Add</span>
          </button>
        )}
      </div>
    </nav>
  );
};

