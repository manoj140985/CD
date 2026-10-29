import React from 'react';
import {
  FileCode2,
  Network,
  CheckCheck,
  Binary,
  Zap,
  Cpu,
  ArrowRight,
  Database,
  Sparkles,
  BookOpen
} from 'lucide-react';
import { SAMPLE_QUERIES } from '../services/catalog';

interface OverviewViewProps {
  onLoadPreset: (sql: string) => void;
  onOpenWorkspace: () => void;
  onOpenSchema: () => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  onLoadPreset,
  onOpenWorkspace,
  onOpenSchema
}) => {
  const compilerPhases = [
    {
      num: '01',
      title: 'Lexical Analysis',
      subtitle: 'Scanner / Tokenizer',
      desc: 'Breaks raw SQL text into a typed token stream (KEYWORDS, IDENTIFIERS, LITERALS, OPERATORS) using deterministic regular expression rules and tracks line/column source positions.',
      icon: FileCode2,
      accent: 'text-cyan-400'
    },
    {
      num: '02',
      title: 'Syntax Analysis',
      subtitle: 'Recursive Descent Parser',
      desc: 'Validates SQL Context-Free Grammar (CFG) productions and builds a hierarchical Abstract Syntax Tree (AST) capturing SELECT, FROM, JOIN, WHERE, GROUP BY, and ORDER BY clauses.',
      icon: Network,
      accent: 'text-indigo-400'
    },
    {
      num: '03',
      title: 'Semantic Analysis',
      subtitle: 'Type & Catalog Validation',
      desc: 'Resolves table existence against the relational schema catalog, disambiguates column identifiers, enforces type compatibility in comparison predicates, and builds the query symbol table.',
      icon: CheckCheck,
      accent: 'text-emerald-400'
    },
    {
      num: '04',
      title: 'Intermediate Representation',
      subtitle: 'Relational Algebra & 3AC',
      desc: 'Translates the parsed query into canonical Relational Algebra (π, σ, ⨝, γ, τ) operators and linear Three-Address Code (TAC / Quadruples) with explicit temporary variable bindings.',
      icon: Binary,
      accent: 'text-violet-400'
    },
    {
      num: '05',
      title: 'Query Optimization',
      subtitle: 'Heuristic Rule Engine',
      desc: 'Applies algebraic rewrite rules including Predicate Pushdown (σ below ⨝), Projection Pushdown, Constant Folding, and Join Reordering to minimize intermediate tuple cardinalities.',
      icon: Zap,
      accent: 'text-amber-400'
    },
    {
      num: '06',
      title: 'Execution Plan',
      subtitle: 'Physical Operators & Cost',
      desc: 'Transforms optimized relational operators into physical engine execution primitives (IndexScan, SeqScan, HashJoin, HashAggregate) with PostgreSQL-compatible EXPLAIN cost modeling.',
      icon: Cpu,
      accent: 'text-rose-400'
    }
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto py-2">
      {/* Hero Banner Card */}
      <div className="p-6 md:p-8 rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/90 via-[#0d131f] to-slate-950 shadow-xl relative overflow-hidden">
        <div className="max-w-3xl space-y-3 relative z-10">
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>Academic Compiler Design Simulator</span>
          </div>

          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-100 tracking-tight">
            Mini SQL Query Compiler & Query Optimizer
          </h1>

          <p className="text-sm md:text-base text-slate-400 leading-relaxed">
            An interactive educational compiler dashboard designed to simulate and visualize every phase of a database query compilation pipeline — from raw lexical scanning and AST generation to algebraic relational optimization and physical execution plan synthesis.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-3">
            <button
              onClick={onOpenWorkspace}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-all shadow-md shadow-cyan-500/20"
            >
              <span>Open SQL Compiler Workspace</span>
              <ArrowRight size={14} />
            </button>

            <button
              onClick={onOpenSchema}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700 font-medium text-xs transition-colors"
            >
              <Database size={14} className="text-cyan-400" />
              <span>Inspect Relational Catalog</span>
            </button>
          </div>
        </div>
      </div>

      {/* Compiler Pipeline Flow */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-100">Compiler Pipeline Architecture</h2>
            <p className="text-xs text-slate-400">
              The 6 canonical phases of SQL parsing, analysis, and cost-based query optimization
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">6 Stages</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {compilerPhases.map((phase) => {
            const Icon = phase.icon;
            return (
              <div
                key={phase.num}
                className="p-5 rounded-xl border border-slate-800/90 bg-[#0d131f] hover:border-slate-700 transition-colors flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-bold text-slate-500">
                      Phase {phase.num}
                    </span>
                    <Icon size={18} className={phase.accent} />
                  </div>

                  <h3 className="text-sm font-bold text-slate-100">{phase.title}</h3>
                  <div className="text-xs font-mono text-slate-400 mb-2">{phase.subtitle}</div>
                  <p className="text-xs text-slate-400 leading-relaxed">{phase.desc}</p>
                </div>

                <div className="pt-2 border-t border-slate-800/60 text-[11px] font-mono text-slate-500">
                  Standard SQL Compiler Stage
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Launch Benchmark Presets */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-cyan-400" />
          <h2 className="text-base font-bold text-slate-100">Compiler Benchmark Query Presets</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SAMPLE_QUERIES.map((query) => (
            <div
              key={query.id}
              className="p-4 rounded-xl border border-slate-800 bg-[#0d131f] hover:border-slate-700 transition-colors flex flex-col justify-between space-y-2"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">{query.title}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {query.category}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{query.description}</p>

                <div className="mt-2 p-2 rounded bg-slate-950 font-mono text-[11px] text-cyan-300/90 truncate">
                  {query.sql.replace(/\n/g, ' ')}
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => onLoadPreset(query.sql)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  <span>Load into Compiler</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
