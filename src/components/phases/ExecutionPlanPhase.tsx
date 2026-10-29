import React, { useState } from 'react';
import { ExecutionPlanResult, PhysicalOperatorNode } from '../../types/compiler';
import { TreeVisualizer, VisualTreeNode } from '../TreeVisualizer';
import { Cpu, Terminal, Layers, Database, Copy, Check, Activity } from 'lucide-react';

interface ExecutionPlanPhaseProps {
  executionPlan: ExecutionPlanResult;
}

export const ExecutionPlanPhase: React.FC<ExecutionPlanPhaseProps> = ({ executionPlan }) => {
  const [viewMode, setViewMode] = useState<'visual' | 'explain'>('visual');
  const [copiedExplain, setCopiedExplain] = useState(false);

  // Convert PhysicalOperatorNode to VisualTreeNode
  const visualTree = React.useMemo(() => {
    function mapNode(node: PhysicalOperatorNode): VisualTreeNode {
      return {
        id: node.id,
        label: `${node.operator}${node.table ? `: ${node.table}` : ''}`,
        type: node.operator,
        subtitle: node.condition || (node.indexUsed ? `Index: ${node.indexUsed}` : undefined),
        badge: `Cost: ${node.totalCost}`,
        details: {
          operator: node.operator,
          table: node.table,
          indexUsed: node.indexUsed,
          condition: node.condition,
          startupCost: node.startupCost,
          totalCost: node.totalCost,
          estimatedRows: node.estimatedRows,
          rowWidthBytes: node.rowWidthBytes,
          memoryKb: node.memoryKb
        },
        children: node.children ? node.children.map(mapNode) : undefined
      };
    }
    return mapNode(executionPlan.planTree);
  }, [executionPlan.planTree]);

  const handleCopyExplain = () => {
    navigator.clipboard.writeText(executionPlan.explainText);
    setCopiedExplain(true);
    setTimeout(() => setCopiedExplain(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl border border-slate-800 bg-[#0d131f]">
          <div className="text-[11px] font-mono text-cyan-400 uppercase">Total Estimated Cost</div>
          <div className="text-xl font-bold text-cyan-300 font-mono tabular-nums mt-1">
            {executionPlan.totalEstimatedCost}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">I/O + CPU cost units</div>
        </div>

        <div className="p-3 rounded-xl border border-slate-800 bg-[#0d131f]">
          <div className="text-[11px] font-mono text-indigo-400 uppercase">Peak Memory (WorkMem)</div>
          <div className="text-xl font-bold text-indigo-300 font-mono tabular-nums mt-1">
            {executionPlan.peakMemoryKb} kB
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Hash table & sort buffer</div>
        </div>

        <div className="p-3 rounded-xl border border-slate-800 bg-[#0d131f]">
          <div className="text-[11px] font-mono text-emerald-400 uppercase">Execution Model</div>
          <div className="text-sm font-bold text-emerald-300 font-mono mt-1 truncate">
            Volcano Iterator
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Demand-driven (Pull)</div>
        </div>

        <div className="p-3 rounded-xl border border-slate-800 bg-[#0d131f]">
          <div className="text-[11px] font-mono text-amber-400 uppercase">Plan Generation Time</div>
          <div className="text-xl font-bold text-amber-300 font-mono tabular-nums mt-1">
            {executionPlan.durationMs}ms
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Physical mapping</div>
        </div>
      </div>

      {/* View Switcher */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
          <button
            onClick={() => setViewMode('visual')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
              viewMode === 'visual'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers size={14} />
            <span>Physical Operator Tree</span>
          </button>
          <button
            onClick={() => setViewMode('explain')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
              viewMode === 'explain'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Terminal size={14} />
            <span>EXPLAIN Output Format</span>
          </button>
        </div>

        {viewMode === 'explain' && (
          <button
            onClick={handleCopyExplain}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs text-slate-300 hover:text-white transition-colors"
          >
            {copiedExplain ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span>{copiedExplain ? 'Copied' : 'Copy EXPLAIN'}</span>
          </button>
        )}
      </div>

      {/* Main View Area */}
      {viewMode === 'visual' ? (
        <div className="space-y-4">
          <TreeVisualizer
            root={visualTree}
            title="Physical Plan Execution Tree (Volcano Model)"
            height="520px"
            accentColor="emerald"
          />

          {/* Physical Operator Details Reference */}
          <div className="p-4 rounded-xl border border-slate-800 bg-[#0d131f]">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800 mb-2.5">
              <Database size={14} className="text-cyan-400" />
              <span className="text-xs font-semibold text-slate-200">Physical Operator Architecture Reference</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800">
                <div className="font-semibold text-cyan-300">IndexScan vs. SeqScan</div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Table scans automatically leverage B-Tree indexes when defined on selective attributes, bypassing full table disk reads.
                </div>
              </div>
              <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800">
                <div className="font-semibold text-indigo-300">Hash Join Algorithm</div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Builds an in-memory hash table on the smaller relation, then probes it in $O(N)$ streaming time with the outer relation.
                </div>
              </div>
              <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800">
                <div className="font-semibold text-emerald-300">Volcano Pipeline Iterators</div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Operators implement <code>open()</code>, <code>next()</code>, and <code>close()</code>, streaming tuples one at a time without materializing full intermediate results.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-[#0d131f] p-4">
          <div className="text-[11px] font-mono text-slate-400 mb-2">
            PostgreSQL-Standard EXPLAIN Representation:
          </div>
          <pre className="p-4 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-300 leading-relaxed overflow-x-auto selection:bg-emerald-500/30">
            {executionPlan.explainText}
          </pre>
        </div>
      )}
    </div>
  );
};
