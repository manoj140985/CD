import React from 'react';
import {
  FileCode2,
  Network,
  CheckCheck,
  Binary,
  Zap,
  Cpu,
  AlertCircle
} from 'lucide-react';
import { CompilerResult } from '../types/compiler';

export type CompilerPhase =
  | 'lexer'
  | 'syntax'
  | 'semantic'
  | 'intermediate'
  | 'optimization'
  | 'execution';

interface PhaseTabsProps {
  activePhase: CompilerPhase;
  onSelectPhase: (phase: CompilerPhase) => void;
  result?: CompilerResult | null;
}

interface PhaseDefinition {
  id: CompilerPhase;
  stepNumber: string;
  name: string;
  subtext: string;
  icon: React.ElementType;
}

const PHASES: PhaseDefinition[] = [
  {
    id: 'lexer',
    stepNumber: '01',
    name: 'Lexical Analysis',
    subtext: 'Token Stream & Scanner',
    icon: FileCode2
  },
  {
    id: 'syntax',
    stepNumber: '02',
    name: 'Syntax Analysis',
    subtext: 'Parser & AST Tree',
    icon: Network
  },
  {
    id: 'semantic',
    stepNumber: '03',
    name: 'Semantic Check',
    subtext: 'Catalog & Symbol Table',
    icon: CheckCheck
  },
  {
    id: 'intermediate',
    stepNumber: '04',
    name: 'Intermediate (IR)',
    subtext: 'Relational Algebra & 3AC',
    icon: Binary
  },
  {
    id: 'optimization',
    stepNumber: '05',
    name: 'Query Optimizer',
    subtext: 'Heuristics & Rule Diff',
    icon: Zap
  },
  {
    id: 'execution',
    stepNumber: '06',
    name: 'Execution Plan',
    subtext: 'Physical Plan & Cost',
    icon: Cpu
  }
];

export const PhaseTabs: React.FC<PhaseTabsProps> = ({
  activePhase,
  onSelectPhase,
  result
}) => {
  const getPhaseStatus = (phaseId: CompilerPhase) => {
    if (!result) return { hasError: false, duration: null };

    switch (phaseId) {
      case 'lexer':
        return {
          hasError: result.lexer.errors.length > 0,
          duration: `${result.lexer.durationMs}ms`,
          count: `${result.lexer.tokenCount} tokens`
        };
      case 'syntax':
        return {
          hasError: result.syntax.errors.length > 0,
          duration: `${result.syntax.durationMs}ms`,
          count: `${result.syntax.nodeCount} nodes`
        };
      case 'semantic':
        return {
          hasError: !result.semantic.isValid,
          duration: `${result.semantic.durationMs}ms`,
          count: `${result.semantic.symbolTable.length} symbols`
        };
      case 'intermediate':
        return {
          hasError: false,
          duration: `${result.intermediate.durationMs}ms`,
          count: `${result.intermediate.tacInstructions.length} TAC lines`
        };
      case 'optimization':
        return {
          hasError: false,
          duration: `${result.optimization.durationMs}ms`,
          count: `-${result.optimization.metrics.costReductionPercent}% cost`
        };
      case 'execution':
        return {
          hasError: false,
          duration: `${result.executionPlan.durationMs}ms`,
          count: `Cost ${result.executionPlan.totalEstimatedCost}`
        };
      default:
        return { hasError: false, duration: null };
    }
  };

  return (
    <div className="w-full overflow-x-auto pb-1 scrollbar-none">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 min-w-[760px]">
        {PHASES.map((phase) => {
          const Icon = phase.icon;
          const isActive = activePhase === phase.id;
          const status = getPhaseStatus(phase.id);

          return (
            <button
              key={phase.id}
              onClick={() => onSelectPhase(phase.id)}
              className={`relative flex flex-col text-left p-3 rounded-xl border transition-all select-none ${
                isActive
                  ? 'border-cyan-500/70 bg-gradient-to-b from-cyan-950/40 to-slate-900 shadow-md shadow-cyan-500/10'
                  : 'border-slate-800/90 bg-slate-900/60 hover:bg-slate-800/60 hover:border-slate-700 text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1.5">
                <span className={`text-[11px] font-mono font-semibold ${isActive ? 'text-cyan-400' : 'text-slate-500'}`}>
                  {phase.stepNumber}
                </span>

                <div className="flex items-center gap-1">
                  {status.hasError ? (
                    <AlertCircle size={13} className="text-rose-400" />
                  ) : null}
                  <Icon
                    size={15}
                    className={isActive ? 'text-cyan-300' : 'text-slate-500'}
                  />
                </div>
              </div>

              <div className={`text-xs font-semibold truncate ${isActive ? 'text-slate-100' : 'text-slate-300'}`}>
                {phase.name}
              </div>

              <div className="text-[11px] text-slate-500 truncate mt-0.5">
                {phase.subtext}
              </div>

              {/* Status pill if available */}
              {status.count && (
                <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span className="truncate">{status.count}</span>
                  {status.duration && <span className="tabular-nums text-slate-500">{status.duration}</span>}
                </div>
              )}

              {/* Active bottom accent bar */}
              {isActive && (
                <div className="absolute bottom-0 left-3 right-3 h-[2px] bg-cyan-400 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
