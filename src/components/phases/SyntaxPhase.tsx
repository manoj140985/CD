import React, { useState } from 'react';
import { SyntaxResult, ASTNode } from '../../types/compiler';
import { TreeVisualizer, VisualTreeNode } from '../TreeVisualizer';
import { Network, FileJson, BookOpen, AlertOctagon, Copy, Check } from 'lucide-react';

interface SyntaxPhaseProps {
  syntax: SyntaxResult;
}

export const SyntaxPhase: React.FC<SyntaxPhaseProps> = ({ syntax }) => {
  const [viewMode, setViewMode] = useState<'visual' | 'json'>('visual');
  const [copied, setCopied] = useState<boolean>(false);

  // Convert ASTNode to VisualTreeNode for TreeVisualizer
  const visualTree = React.useMemo(() => {
    function mapNode(node: ASTNode): VisualTreeNode {
      return {
        id: node.id,
        label: node.label,
        type: node.type,
        subtitle: node.grammarRule,
        badge: node.value ? `val: ${node.value}` : undefined,
        details: {
          grammarRule: node.grammarRule,
          attributes: node.attributes,
          position: node.line ? `Line ${node.line}, Col ${node.column}` : undefined
        },
        children: node.children ? node.children.map(mapNode) : undefined
      };
    }
    return mapNode(syntax.ast);
  }, [syntax.ast]);

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(syntax.ast, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Header and KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl border border-slate-800 bg-[#0d131f]">
          <div className="text-[11px] font-mono text-slate-500 uppercase">AST Node Count</div>
          <div className="text-xl font-bold text-slate-100 font-mono tabular-nums mt-1">{syntax.nodeCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Parse tree entities</div>
        </div>

        <div className="p-3 rounded-xl border border-slate-800 bg-[#0d131f]">
          <div className="text-[11px] font-mono text-cyan-400 uppercase">Tree Depth</div>
          <div className="text-xl font-bold text-cyan-300 font-mono tabular-nums mt-1">{syntax.depth}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Hierarchy levels</div>
        </div>

        <div className="p-3 rounded-xl border border-slate-800 bg-[#0d131f]">
          <div className="text-[11px] font-mono text-indigo-400 uppercase">Grammar Rules</div>
          <div className="text-xl font-bold text-indigo-300 font-mono tabular-nums mt-1">{syntax.grammarRulesApplied.length}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Productions fired</div>
        </div>

        <div className="p-3 rounded-xl border border-slate-800 bg-[#0d131f]">
          <div className="text-[11px] font-mono text-emerald-400 uppercase">Parse Duration</div>
          <div className="text-xl font-bold text-emerald-300 font-mono tabular-nums mt-1">{syntax.durationMs}ms</div>
          <div className="text-[11px] text-slate-400 mt-0.5">LL(1) / Recursive descent</div>
        </div>
      </div>

      {/* Syntax Errors Card if any */}
      {syntax.errors.length > 0 && (
        <div className="p-4 rounded-xl border border-rose-500/50 bg-rose-950/30 text-rose-200 text-xs space-y-2">
          <div className="flex items-center gap-2 font-semibold text-rose-100">
            <AlertOctagon size={16} className="text-rose-400" />
            <span>Syntax Parser Diagnostics ({syntax.errors.length} errors found)</span>
          </div>
          <div className="space-y-2">
            {syntax.errors.map((err, i) => (
              <div key={i} className="p-2.5 rounded bg-rose-950/50 border border-rose-800/60 font-mono">
                <div className="text-rose-200 font-semibold">{err.message}</div>
                <div className="text-[11px] text-rose-400 mt-1">
                  Position: Line {err.line}, Column {err.column} · Expected: <span className="text-cyan-300">{err.expectedToken || 'Unknown'}</span> · Found: <span className="text-rose-300">{err.foundToken || 'EOF'}</span>
                </div>
                {err.suggestion && (
                  <div className="text-[11px] text-emerald-300 mt-1">
                    Suggestion: {err.suggestion}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View Switcher Bar */}
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
            <Network size={14} />
            <span>Visual AST Tree</span>
          </button>
          <button
            onClick={() => setViewMode('json')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
              viewMode === 'json'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileJson size={14} />
            <span>Structured JSON AST</span>
          </button>
        </div>

        {viewMode === 'json' && (
          <button
            onClick={handleCopyJSON}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs text-slate-300 hover:text-white transition-colors"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span>{copied ? 'Copied AST' : 'Copy JSON'}</span>
          </button>
        )}
      </div>

      {/* Main Content Area */}
      {viewMode === 'visual' ? (
        <div className="space-y-4">
          <TreeVisualizer
            root={visualTree}
            title="Abstract Syntax Tree (AST)"
            height="520px"
            accentColor="cyan"
          />

          {/* Grammar Production Rules Reference */}
          <div className="p-4 rounded-xl border border-slate-800 bg-[#0d131f]">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800 mb-2.5">
              <BookOpen size={14} className="text-indigo-400" />
              <span className="text-xs font-semibold text-slate-200">Applied Context-Free Grammar (CFG) Productions</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
              {syntax.grammarRulesApplied.map((rule, idx) => (
                <div key={idx} className="p-2 rounded bg-slate-950/60 border border-slate-800/80 text-slate-300">
                  <span className="text-cyan-400 mr-2">{idx + 1}.</span>
                  {rule}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-[#0d131f] p-4">
          <div className="text-[11px] font-mono text-slate-400 mb-2">Hierarchical AST JSON Payload:</div>
          <pre className="max-h-[500px] overflow-auto p-4 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-cyan-200 selection:bg-cyan-500/30">
            {JSON.stringify(syntax.ast, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
