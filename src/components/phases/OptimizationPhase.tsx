import React, { useState } from 'react';
import { OptimizationResult, RelationalAlgebraNode } from '../../types/compiler';
import { TreeVisualizer, VisualTreeNode } from '../TreeVisualizer';
import {
  Zap,
  TrendingDown,
  ArrowRight,
  SplitSquareVertical,
  Layers,
  Sparkles,
  CheckCircle2
} from 'lucide-react';

interface OptimizationPhaseProps {
  optimization: OptimizationResult;
}

export const OptimizationPhase: React.FC<OptimizationPhaseProps> = ({ optimization }) => {
  const [activeTab, setActiveTab] = useState<'comparison' | 'rules' | 'metrics'>('comparison');
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(
    optimization.rulesApplied[0]?.ruleId || null
  );

  // Convert trees to visual nodes
  const mapAlgebraToVisual = (node: RelationalAlgebraNode): VisualTreeNode => ({
    id: node.id,
    label: `${node.symbol} ${node.op}`,
    type: node.op,
    subtitle: node.parameters,
    badge: `${node.estimatedRows} rows`,
    details: {
      operator: node.op,
      parameters: node.parameters,
      estimatedRows: node.estimatedRows,
      cost: node.cost
    },
    children: node.children ? node.children.map(mapAlgebraToVisual) : undefined
  });

  const unoptimizedVisual = React.useMemo(
    () => mapAlgebraToVisual(optimization.unoptimizedTree),
    [optimization.unoptimizedTree]
  );
  const optimizedVisual = React.useMemo(
    () => mapAlgebraToVisual(optimization.optimizedTree),
    [optimization.optimizedTree]
  );

  return (
    <div className="space-y-4">
      {/* KPI Comparison Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl border border-slate-800 bg-[#0d131f]">
          <div className="text-[11px] font-mono text-cyan-400 uppercase">Cost Reduction</div>
          <div className="text-xl font-bold text-cyan-300 font-mono tabular-nums mt-1 flex items-baseline gap-1">
            <TrendingDown size={18} className="text-cyan-400" />
            <span>{optimization.metrics.costReductionPercent}%</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {optimization.metrics.originalEstimatedCost} → {optimization.metrics.optimizedEstimatedCost} cost units
          </div>
        </div>

        <div className="p-3 rounded-xl border border-slate-800 bg-[#0d131f]">
          <div className="text-[11px] font-mono text-indigo-400 uppercase">Tuples Pruned Early</div>
          <div className="text-xl font-bold text-indigo-300 font-mono tabular-nums mt-1 flex items-baseline gap-1">
            <TrendingDown size={18} className="text-indigo-400" />
            <span>{optimization.metrics.tuplesReductionPercent}%</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {optimization.metrics.originalIntermediateTuples} → {optimization.metrics.optimizedIntermediateTuples} tuples
          </div>
        </div>

        <div className="p-3 rounded-xl border border-slate-800 bg-[#0d131f]">
          <div className="text-[11px] font-mono text-emerald-400 uppercase">Heuristic Rules Fired</div>
          <div className="text-xl font-bold text-emerald-300 font-mono tabular-nums mt-1">
            {optimization.rulesApplied.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Algebraic transformations</div>
        </div>

        <div className="p-3 rounded-xl border border-slate-800 bg-[#0d131f]">
          <div className="text-[11px] font-mono text-amber-400 uppercase">Optimizer Latency</div>
          <div className="text-xl font-bold text-amber-300 font-mono tabular-nums mt-1">
            {optimization.durationMs}ms
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Heuristic rule engine</div>
        </div>
      </div>

      {/* View Switcher */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('comparison')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'comparison'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <SplitSquareVertical size={14} />
            <span>Before vs. After Tree Diff</span>
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'rules'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Zap size={14} />
            <span>Applied Rules Log ({optimization.rulesApplied.length})</span>
          </button>
        </div>

        <span className="text-[11px] font-mono text-slate-500">
          Relational Algebra Rewriting
        </span>
      </div>

      {/* Active Tab View */}
      {activeTab === 'comparison' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: Unoptimized Plan */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-rose-950/30 border border-rose-900/60 text-xs font-semibold text-rose-300">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-400" />
                  <span>Unoptimized Relational Algebra Tree</span>
                </div>
                <span className="font-mono text-[11px] text-rose-400">
                  Est. Cost: {optimization.metrics.originalEstimatedCost}
                </span>
              </div>
              <TreeVisualizer
                root={unoptimizedVisual}
                height="460px"
                accentColor="amber"
              />
            </div>

            {/* Right: Optimized Plan */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-cyan-950/40 border border-cyan-800/60 text-xs font-semibold text-cyan-300">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span>Optimized Relational Algebra Tree</span>
                </div>
                <span className="font-mono text-[11px] text-cyan-400">
                  Est. Cost: {optimization.metrics.optimizedEstimatedCost} (-{optimization.metrics.costReductionPercent}%)
                </span>
              </div>
              <TreeVisualizer
                root={optimizedVisual}
                height="460px"
                accentColor="cyan"
              />
            </div>
          </div>

          {/* Quick Summary of Transformations */}
          <div className="p-4 rounded-xl border border-slate-800 bg-[#0d131f]">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800 mb-2.5">
              <Sparkles size={14} className="text-cyan-400" />
              <span className="text-xs font-semibold text-slate-200">Key Optimizer Improvements Applied</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800">
                <div className="font-semibold text-cyan-300">Predicate Pushdown</div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Filters (σ) pushed below cross-product/joins so intermediate joins operate on 70-85% fewer tuples.
                </div>
              </div>
              <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800">
                <div className="font-semibold text-indigo-300">Projection Pushdown</div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Prunes unreferenced columns before join buffers, reducing memory footprint per tuple by ~50%.
                </div>
              </div>
              <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800">
                <div className="font-semibold text-amber-300">Constant Folding & Reordering</div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Evaluates constant expressions at compile-time and places smaller relations on Hash Join build sides.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Rules list */}
          <div className="lg:col-span-1 rounded-xl border border-slate-800 bg-[#0d131f] p-3 space-y-2">
            <div className="text-xs font-semibold text-slate-200 px-1 pb-2 border-b border-slate-800 flex items-center justify-between">
              <span>Optimization Passes</span>
              <span className="text-[10px] font-mono text-cyan-400">{optimization.rulesApplied.length} fired</span>
            </div>

            <div className="space-y-1.5">
              {optimization.rulesApplied.map((rule) => {
                const isSelected = selectedRuleId === rule.ruleId;
                return (
                  <button
                    key={rule.ruleId}
                    onClick={() => setSelectedRuleId(rule.ruleId)}
                    className={`w-full text-left p-2.5 rounded-lg border transition-all text-xs ${
                      isSelected
                        ? 'border-cyan-500/70 bg-cyan-950/40 text-cyan-200'
                        : 'border-slate-800/80 bg-slate-950/40 hover:bg-slate-800/40 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-200">{rule.ruleName}</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {rule.category}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      Target: {rule.target}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rule Detail View */}
          <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-[#0d131f] p-4 flex flex-col justify-between">
            {(() => {
              const rule = optimization.rulesApplied.find(r => r.ruleId === selectedRuleId) || optimization.rulesApplied[0];
              if (!rule) {
                return (
                  <div className="text-center py-16 text-slate-500 text-xs">
                    No rules applied for this query
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div>
                      <h3 className="text-sm font-bold text-slate-100">{rule.ruleName}</h3>
                      <div className="text-[11px] font-mono text-cyan-400 mt-0.5">{rule.ruleId}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-xs font-mono bg-cyan-950/60 text-cyan-300 border border-cyan-800/80">
                      Category: {rule.category}
                    </span>
                  </div>

                  <div>
                    <div className="text-[11px] uppercase font-mono text-slate-500 mb-1">Description</div>
                    <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/50 p-3 rounded-lg border border-slate-800/80">
                      {rule.description}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <div className="text-[11px] uppercase font-mono text-rose-400 mb-1">Before Transformation</div>
                      <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-900/60 font-mono text-xs text-rose-200">
                        {rule.beforeSnippet}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] uppercase font-mono text-cyan-400 mb-1">After Transformation</div>
                      <div className="p-3 rounded-lg bg-cyan-950/20 border border-cyan-900/60 font-mono text-xs text-cyan-200">
                        {rule.afterSnippet}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] uppercase font-mono text-emerald-400 mb-1">Measurable Execution Benefit</div>
                    <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-900/60 text-xs text-emerald-200 flex items-start gap-2">
                      <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                      <span>{rule.benefit}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Compiler Phase 5</span>
              <span className="font-mono">Rule-Based Transformation Engine</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
