import React, { useState } from 'react';
import { IntermediateResult, RelationalAlgebraNode } from '../../types/compiler';
import { TreeVisualizer, VisualTreeNode } from '../TreeVisualizer';
import { Binary, Sigma, ListTree, Code, Copy, Check } from 'lucide-react';

interface IntermediatePhaseProps {
  intermediate: IntermediateResult;
}

export const IntermediatePhase: React.FC<IntermediatePhaseProps> = ({ intermediate }) => {
  const [viewMode, setViewMode] = useState<'tree' | 'tac'>('tree');
  const [copiedMath, setCopiedMath] = useState(false);

  // Convert RelationalAlgebraNode to VisualTreeNode
  const visualTree = React.useMemo(() => {
    function mapNode(node: RelationalAlgebraNode): VisualTreeNode {
      return {
        id: node.id,
        label: `${node.symbol} ${node.op}`,
        type: node.op,
        subtitle: node.parameters,
        badge: `${node.estimatedRows} rows`,
        details: {
          operator: node.op,
          parameters: node.parameters,
          estimatedRows: node.estimatedRows,
          estimatedCost: node.cost,
          schema: node.schema
        },
        children: node.children ? node.children.map(mapNode) : undefined
      };
    }
    return mapNode(intermediate.algebraTree);
  }, [intermediate.algebraTree]);

  const handleCopyMath = () => {
    navigator.clipboard.writeText(intermediate.algebraText);
    setCopiedMath(true);
    setTimeout(() => setCopiedMath(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Mathematical Relational Algebra Expression Card */}
      <div className="p-4 rounded-xl border border-slate-800 bg-[#0d131f] space-y-2">
        <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2 font-semibold text-slate-200">
            <Sigma size={15} className="text-cyan-400" />
            <span>Canonical Relational Algebra Expression (Pre-Optimization)</span>
          </div>
          <button
            onClick={handleCopyMath}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-800 text-[11px] font-mono text-slate-300 hover:text-white transition-colors border border-slate-700/80"
          >
            {copiedMath ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            <span>{copiedMath ? 'Copied' : 'Copy RA'}</span>
          </button>
        </div>

        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 font-mono text-xs text-cyan-200 overflow-x-auto leading-relaxed">
          {intermediate.algebraText}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-1 font-mono">
          <span>π = Projection</span>
          <span>σ = Selection</span>
          <span>⨝ = Join</span>
          <span>γ = Aggregate</span>
          <span>τ = Sort</span>
          <span>R = Table Scan</span>
        </div>
      </div>

      {/* View Switcher: RA Operator Tree vs Three-Address Code */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
          <button
            onClick={() => setViewMode('tree')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
              viewMode === 'tree'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ListTree size={14} />
            <span>Relational Algebra Tree</span>
          </button>
          <button
            onClick={() => setViewMode('tac')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
              viewMode === 'tac'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Code size={14} />
            <span>Three-Address Code (3AC)</span>
          </button>
        </div>

        <div className="text-[11px] font-mono text-slate-500">
          Generated in {intermediate.durationMs}ms
        </div>
      </div>

      {/* View Display */}
      {viewMode === 'tree' ? (
        <TreeVisualizer
          root={visualTree}
          title="Relational Algebra Operator Tree"
          height="520px"
          accentColor="indigo"
        />
      ) : (
        <div className="rounded-xl border border-slate-800 bg-[#0d131f] overflow-hidden">
          <div className="p-3 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-semibold text-slate-200">
              <Binary size={15} className="text-cyan-400" />
              <span>Linearized Three-Address Code (Quadruples)</span>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              {intermediate.tacInstructions.length} instructions
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] text-slate-400">
                <tr>
                  <th className="py-2 px-3 w-12">#</th>
                  <th className="py-2 px-3 w-28">Result Temp</th>
                  <th className="py-2 px-3 w-28">Operation</th>
                  <th className="py-2 px-3">Arguments</th>
                  <th className="py-2 px-3">Compiler Semantics</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {intermediate.tacInstructions.map((ins) => (
                  <tr key={ins.index} className="hover:bg-slate-800/40 text-slate-300">
                    <td className="py-2 px-3 text-slate-500">{ins.index}</td>
                    <td className="py-2 px-3 font-semibold text-cyan-300">{ins.result}</td>
                    <td className="py-2 px-3">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 border border-slate-700 text-indigo-300">
                        {ins.op}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-amber-200 truncate max-w-xs">
                      {ins.arg1}
                      {ins.arg2 ? `, ${ins.arg2}` : ''}
                    </td>
                    <td className="py-2 px-3 text-slate-400 text-[11px]">
                      {ins.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
