import React from 'react';
import { Database, Play } from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenSchemaModal: () => void;
  onExecuteQuery: () => void;
  isCompiling: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onOpenSchemaModal,
  onExecuteQuery,
  isCompiling
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/90 bg-[#0b0f17]/90 backdrop-blur-md">
      <div className="flex items-center justify-between gap-8 px-4 sm:px-6 py-3 max-w-7xl mx-auto">
        {/* Zone 1: Single text element wordmark */}
        <button
          onClick={() => onSelectTab('editor')}
          className="flex items-center gap-2.5 text-left text-slate-100 hover:text-cyan-400 transition-colors whitespace-nowrap shrink-0 group"
        >
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:border-cyan-400 transition-colors">
            <Database size={16} />
          </div>
          <div>
            <div className="text-sm font-extrabold tracking-tight">Mini SQL Compiler</div>
            <div className="text-[10px] font-mono text-slate-400 leading-none">Compiler Design Lab</div>
          </div>
        </button>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-400">
          <button
            onClick={() => onSelectTab('overview')}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              currentTab === 'overview' ? 'text-cyan-400 font-semibold' : 'hover:text-slate-200'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => onSelectTab('editor')}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              currentTab === 'editor' ? 'text-cyan-400 font-semibold' : 'hover:text-slate-200'
            }`}
          >
            SQL Workspace
          </button>
          <button
            onClick={onOpenSchemaModal}
            className="hover:text-slate-200 transition-colors whitespace-nowrap shrink-0"
          >
            Relational Catalog
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onExecuteQuery}
            disabled={isCompiling}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg shadow-md shadow-cyan-500/20 active:scale-95 disabled:opacity-50 transition-all whitespace-nowrap shrink-0"
          >
            {isCompiling ? (
              <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Play size={13} className="fill-slate-950" />
            )}
            <span>Compile</span>
          </button>
        </div>
      </div>
    </header>
  );
};
