import React from 'react';
import { SemanticResult } from '../../types/compiler';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Table2,
  ShieldCheck,
  Binary
} from 'lucide-react';

interface SemanticPhaseProps {
  semantic: SemanticResult;
}

export const SemanticPhase: React.FC<SemanticPhaseProps> = ({ semantic }) => {
  return (
    <div className="space-y-4">
      {/* Header and KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl border border-slate-800 bg-[#0d131f]">
          <div className="text-[11px] font-mono text-slate-500 uppercase">Semantic Status</div>
          <div className="flex items-center gap-1.5 mt-1">
            {semantic.isValid ? (
              <>
                <CheckCircle2 size={18} className="text-emerald-400" />
                <span className="text-base font-bold text-emerald-400">Validated</span>
              </>
            ) : (
              <>
                <XCircle size={18} className="text-rose-400" />
                <span className="text-base font-bold text-rose-400">Semantic Error</span>
              </>
            )}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Catalog consistency</div>
        </div>

        <div className="p-3 rounded-xl border border-slate-800 bg-[#0d131f]">
          <div className="text-[11px] font-mono text-cyan-400 uppercase">Resolved Tables</div>
          <div className="text-xl font-bold text-cyan-300 font-mono tabular-nums mt-1">
            {semantic.resolvedTables.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 truncate">
            {semantic.resolvedTables.join(', ') || 'None'}
          </div>
        </div>

        <div className="p-3 rounded-xl border border-slate-800 bg-[#0d131f]">
          <div className="text-[11px] font-mono text-indigo-400 uppercase">Symbol Table Entries</div>
          <div className="text-xl font-bold text-indigo-300 font-mono tabular-nums mt-1">
            {semantic.symbolTable.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Identifiers bound</div>
        </div>

        <div className="p-3 rounded-xl border border-slate-800 bg-[#0d131f]">
          <div className="text-[11px] font-mono text-amber-400 uppercase">Diagnostics</div>
          <div className="text-xl font-bold text-amber-300 font-mono tabular-nums mt-1">
            {semantic.diagnostics.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Checked in {semantic.durationMs}ms</div>
        </div>
      </div>

      {/* Diagnostics List */}
      {semantic.diagnostics.length > 0 && (
        <div className="space-y-2">
          {semantic.diagnostics.map(diag => {
            const isError = diag.severity === 'error';
            const isWarning = diag.severity === 'warning';

            return (
              <div
                key={diag.id}
                className={`p-3.5 rounded-xl border text-xs ${
                  isError
                    ? 'border-rose-500/50 bg-rose-950/20 text-rose-200'
                    : isWarning
                    ? 'border-amber-500/50 bg-amber-950/20 text-amber-200'
                    : 'border-cyan-500/40 bg-cyan-950/20 text-cyan-200'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {isError ? (
                    <XCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                  ) : isWarning ? (
                    <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                  ) : (
                    <Info size={16} className="text-cyan-400 shrink-0 mt-0.5" />
                  )}

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 font-mono">
                      <span className="font-semibold">{diag.code}</span>
                      {diag.line && (
                        <span className="text-[11px] opacity-75">
                          Line {diag.line}:{diag.column}
                        </span>
                      )}
                    </div>
                    <div className="text-slate-200 font-medium">{diag.message}</div>
                    {diag.hint && (
                      <div className="text-[11px] text-slate-400 mt-1 italic">
                        Guidance: {diag.hint}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Split: Symbol Table and Schema Verification Checklist */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Symbol Table */}
        <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-[#0d131f] flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-semibold text-slate-200">
              <Table2 size={15} className="text-cyan-400" />
              <span>Resolved Symbol Table (Scope & Type Resolution)</span>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              {semantic.symbolTable.length} records
            </span>
          </div>

          <div className="max-h-[380px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead className="sticky top-0 bg-slate-900/90 backdrop-blur border-b border-slate-800 text-[11px] text-slate-400">
                <tr>
                  <th className="py-2 px-3">Symbol Name</th>
                  <th className="py-2 px-3">Category</th>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3">Scope / Resolved Table</th>
                  <th className="py-2 px-3 text-right">Nullable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {semantic.symbolTable.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                      No symbols registered
                    </td>
                  </tr>
                ) : (
                  semantic.symbolTable.map((sym, i) => (
                    <tr key={i} className="hover:bg-slate-800/40 transition-colors text-slate-300">
                      <td className="py-2 px-3 font-semibold text-slate-100">{sym.name}</td>
                      <td className="py-2 px-3">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 border border-slate-700 text-cyan-300">
                          {sym.category}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-indigo-300">{sym.dataType}</td>
                      <td className="py-2 px-3 text-slate-400">
                        {sym.resolvedTable ? `${sym.resolvedTable} (${sym.scope})` : sym.scope}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-500">
                        {sym.isNullable ? 'YES' : 'NO'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Verification Checklist Card */}
        <div className="rounded-xl border border-slate-800 bg-[#0d131f] p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800 mb-3">
              <ShieldCheck size={16} className="text-emerald-400" />
              <span className="font-semibold text-slate-200 text-xs">Catalog Semantic Rules</span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-2.5 rounded bg-slate-950/50 border border-slate-800 flex items-start gap-2">
                <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-200">Catalog Table Existence</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Verifies all relations in FROM and JOIN clauses exist in the system catalog metadata.
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded bg-slate-950/50 border border-slate-800 flex items-start gap-2">
                <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-200">Column Disambiguation</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Checks unqualified column names against all joined table schemas to prevent ambiguous lookups.
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded bg-slate-950/50 border border-slate-800 flex items-start gap-2">
                <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-200">Predicate Type Compatibility</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Ensures operands in binary comparisons have compatible or castable SQL data types.
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded bg-slate-950/50 border border-slate-800 flex items-start gap-2">
                <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-200">Aggregate & Group By Semantics</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Ensures every non-aggregate projection column is present in the GROUP BY expression list.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Compiler Phase 3</span>
            <span className="font-mono">Catalog Type Checker</span>
          </div>
        </div>
      </div>
    </div>
  );
};
