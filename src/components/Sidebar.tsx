import React from 'react';
import {
  Compass,
  Code2,
  Database,
  Zap,
  Server,
  FileCode2,
  BookOpen,
  ChevronRight
} from 'lucide-react';
import { SAMPLE_QUERIES } from '../services/catalog';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenSchemaModal: () => void;
  onLoadPreset: (sql: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  onOpenSchemaModal,
  onLoadPreset
}) => {
  return (
    <aside className="w-64 shrink-0 hidden lg:flex flex-col border-r border-slate-800/80 bg-[#0c111c] p-3 space-y-6 select-none">
      {/* Primary Navigation */}
      <div className="space-y-1">
        <div className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-500">
          Navigation
        </div>

        <button
          onClick={() => onSelectTab('overview')}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            currentTab === 'overview'
              ? 'bg-cyan-500/10 text-cyan-300 font-semibold border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <Compass size={15} className={currentTab === 'overview' ? 'text-cyan-400' : 'text-slate-500'} />
          <span>Overview & Theory</span>
        </button>

        <button
          onClick={() => onSelectTab('editor')}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            currentTab === 'editor'
              ? 'bg-cyan-500/10 text-cyan-300 font-semibold border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <Code2 size={15} className={currentTab === 'editor' ? 'text-cyan-400' : 'text-slate-500'} />
          <span>SQL Editor & Pipeline</span>
        </button>

        <button
          onClick={onOpenSchemaModal}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 transition-colors"
        >
          <Database size={15} className="text-slate-500" />
          <span>Catalog Schema</span>
        </button>
      </div>

      {/* Query Presets Quick List */}
      <div className="space-y-1.5 flex-1 overflow-y-auto">
        <div className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-500 flex items-center justify-between">
          <span>Query Presets</span>
          <span>{SAMPLE_QUERIES.length}</span>
        </div>

        <div className="space-y-1">
          {SAMPLE_QUERIES.map(q => (
            <button
              key={q.id}
              onClick={() => {
                onLoadPreset(q.sql);
                onSelectTab('editor');
              }}
              className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-slate-900/80 transition-colors group"
            >
              <div className="font-medium text-slate-300 group-hover:text-cyan-300 transition-colors truncate">
                {q.title}
              </div>
              <div className="text-[10px] font-mono text-slate-500 truncate mt-0.5">
                {q.category}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Footer Info Box */}
      <div className="p-3 rounded-xl border border-slate-800/80 bg-slate-950/60 text-xs space-y-1.5">
        <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
          <BookOpen size={13} className="text-cyan-400" />
          <span>Lab Specifications</span>
        </div>
        <p className="text-[11px] text-slate-500 leading-normal">
          Compiler pipeline implementation covers Lexing, AST Parsing, Semantic Catalog Binding, Relational Algebra, Heuristic Optimization, and Volcano Execution Plans.
        </p>
      </div>
    </aside>
  );
};
