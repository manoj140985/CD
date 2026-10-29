import React, { useState } from 'react';
import { Play, Sparkles, Trash2, Code2, AlertTriangle, CheckCircle2, ChevronDown } from 'lucide-react';
import { SAMPLE_QUERIES } from '../services/catalog';

interface SqlEditorProps {
  sql: string;
  onChange: (value: string) => void;
  onExecute: () => void;
  isCompiling: boolean;
  hasErrors?: boolean;
  totalTokens?: number;
  durationMs?: number;
}

export const SqlEditor: React.FC<SqlEditorProps> = ({
  sql,
  onChange,
  onExecute,
  isCompiling,
  hasErrors,
  totalTokens = 0,
  durationMs = 0
}) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>('pushdown_demo');
  const [showPresetsMenu, setShowPresetsMenu] = useState<boolean>(false);

  const lines = sql.split('\n');

  const handleSelectPreset = (preset: typeof SAMPLE_QUERIES[0]) => {
    setSelectedPresetId(preset.id);
    onChange(preset.sql);
    setShowPresetsMenu(false);
  };

  const handleFormatSQL = () => {
    // Simple clean standard SQL formatter
    const formatted = sql
      .replace(/\s+/g, ' ')
      .replace(/\s*,\s*/g, ', ')
      .replace(/\bSELECT\b/gi, 'SELECT')
      .replace(/\bFROM\b/gi, '\nFROM')
      .replace(/\b(INNER|LEFT|RIGHT|FULL)?\s*JOIN\b/gi, match => `\n${match.toUpperCase()}`)
      .replace(/\bWHERE\b/gi, '\nWHERE')
      .replace(/\bAND\b/gi, '\n  AND')
      .replace(/\bOR\b/gi, '\n  OR')
      .replace(/\bGROUP BY\b/gi, '\nGROUP BY')
      .replace(/\bHAVING\b/gi, '\nHAVING')
      .replace(/\bORDER BY\b/gi, '\nORDER BY')
      .replace(/\bLIMIT\b/gi, '\nLIMIT')
      .trim();
    onChange(formatted);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Cmd+Enter to run
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onExecute();
    }
  };

  return (
    <div className="flex flex-col rounded-xl border border-slate-800 bg-[#0d131f] shadow-lg overflow-hidden">
      {/* Editor Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-800/80 bg-slate-900/70 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
            <Code2 size={15} className="text-cyan-400" />
            <span>SQL Query Source</span>
          </div>

          {/* Preset Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowPresetsMenu(!showPresetsMenu)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-slate-800/90 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 transition-colors"
            >
              <span className="text-slate-400 font-normal">Preset:</span>
              <span className="truncate max-w-[140px] sm:max-w-[200px]">
                {SAMPLE_QUERIES.find(q => q.id === selectedPresetId)?.title || 'Select preset'}
              </span>
              <ChevronDown size={13} className="text-slate-400" />
            </button>

            {showPresetsMenu && (
              <div className="absolute left-0 top-full mt-1.5 w-80 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl py-1.5 z-30">
                <div className="px-3 py-1 text-[11px] font-mono uppercase text-slate-400 border-b border-slate-800 mb-1">
                  University Lab Benchmarks
                </div>
                {SAMPLE_QUERIES.map(q => (
                  <button
                    key={q.id}
                    onClick={() => handleSelectPreset(q)}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-800/90 transition-colors ${
                      selectedPresetId === q.id ? 'bg-cyan-950/40 text-cyan-300 border-l-2 border-cyan-400' : 'text-slate-300'
                    }`}
                  >
                    <div className="font-medium text-slate-200">{q.title}</div>
                    <div className="text-[11px] text-slate-400 line-clamp-1">{q.description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleFormatSQL}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-md transition-colors"
            title="Auto-format SQL"
          >
            <Sparkles size={13} className="text-indigo-400" />
            <span>Format</span>
          </button>

          <button
            onClick={() => onChange('')}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-md transition-colors"
            title="Clear editor"
          >
            <Trash2 size={13} />
            <span className="hidden sm:inline">Clear</span>
          </button>

          <button
            onClick={onExecute}
            disabled={isCompiling || !sql.trim()}
            className="flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-md bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-sans shadow-md shadow-cyan-500/20 active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition-all"
          >
            {isCompiling ? (
              <span className="w-3.5 h-3.5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Play size={13} className="fill-slate-950" />
            )}
            <span>{isCompiling ? 'Compiling...' : 'Run Compiler'}</span>
            <kbd className="hidden lg:inline text-[9px] font-mono px-1 py-0.2 rounded bg-cyan-600/40 text-slate-950">
              Ctrl+Enter
            </kbd>
          </button>
        </div>
      </div>

      {/* Editor Body with Line Numbers */}
      <div className="relative flex min-h-[160px] max-h-[260px] font-mono text-xs overflow-hidden">
        {/* Line Numbers Column */}
        <div className="w-12 py-3 select-none bg-slate-950/60 border-r border-slate-800/80 text-right pr-3 text-slate-600 font-mono text-[11px] leading-[20px]">
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>

        {/* Textarea Code Input */}
        <textarea
          value={sql}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="-- Enter SQL query (e.g., SELECT s.name FROM students s WHERE s.gpa > 3.5;)"
          spellCheck={false}
          className="flex-1 p-3 bg-transparent text-slate-100 resize-none outline-none font-mono text-xs leading-[20px] placeholder:text-slate-600 selection:bg-cyan-500/30 overflow-y-auto"
        />
      </div>

      {/* Editor Status Footer */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t border-slate-800/80 bg-slate-950/40 text-[11px] text-slate-400">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {hasErrors ? (
              <>
                <AlertTriangle size={13} className="text-amber-400" />
                <span className="text-amber-300 font-medium">Compiler Diagnostics Reported</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={13} className="text-emerald-400" />
                <span className="text-emerald-400 font-medium">Validated & Compiled</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 font-mono tabular-nums text-slate-500">
          <span>{totalTokens} tokens</span>
          <span>·</span>
          <span>{durationMs}ms</span>
        </div>
      </div>
    </div>
  );
};
