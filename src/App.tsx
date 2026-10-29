import React, { useState, useEffect, useCallback } from 'react';
import { CompilerResult, TableSchema } from './types/compiler';
import { UNIVERSITY_CATALOG, SAMPLE_QUERIES } from './services/catalog';
import { compileSQL } from './services/compilerEngine';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { SqlEditor } from './components/SqlEditor';
import { PhaseTabs, CompilerPhase } from './components/PhaseTabs';
import { LexicalPhase } from './components/phases/LexicalPhase';
import { SyntaxPhase } from './components/phases/SyntaxPhase';
import { SemanticPhase } from './components/phases/SemanticPhase';
import { IntermediatePhase } from './components/phases/IntermediatePhase';
import { OptimizationPhase } from './components/phases/OptimizationPhase';
import { ExecutionPlanPhase } from './components/phases/ExecutionPlanPhase';
import { OverviewView } from './components/OverviewView';
import { SchemaModal } from './components/SchemaModal';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function App() {
  const [sql, setSql] = useState<string>(SAMPLE_QUERIES[0].sql);
  const [currentTab, setCurrentTab] = useState<string>('editor');
  const [activePhase, setActivePhase] = useState<CompilerPhase>('optimization');
  const [catalog, setCatalog] = useState<Record<string, TableSchema>>(UNIVERSITY_CATALOG);
  const [compilerResult, setCompilerResult] = useState<CompilerResult | null>(null);
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [compilerError, setCompilerError] = useState<string | null>(null);

  // Schema Modal state
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState<boolean>(false);

  // Core compilation handler
  const handleExecute = useCallback(async (queryToRun?: string) => {
    const query = queryToRun !== undefined ? queryToRun : sql;
    if (!query.trim()) return;

    setIsCompiling(true);
    setCompilerError(null);

    try {
      const res = await compileSQL(query, catalog);
      setCompilerResult(res);
    } catch (err: any) {
      console.error('Compilation failed:', err);
      setCompilerError(err.message || 'Compilation failed');
    } finally {
      setIsCompiling(false);
    }
  }, [sql, catalog]);

  // Initial compile on mount
  useEffect(() => {
    handleExecute(SAMPLE_QUERIES[0].sql);
  }, []);

  const handleLoadPreset = (presetSql: string) => {
    setSql(presetSql);
    handleExecute(presetSql);
  };

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Navigation Bar */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenSchemaModal={() => setIsSchemaModalOpen(true)}
        onExecuteQuery={() => handleExecute()}
        isCompiling={isCompiling}
      />

      {/* Main Body with Sidebar + Viewport */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          onOpenSchemaModal={() => setIsSchemaModalOpen(true)}
          onLoadPreset={handleLoadPreset}
        />

        {/* Content Viewport */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {/* Error Banner if compilation failed */}
          {compilerError && (
            <div className="mb-5 p-4 rounded-xl border border-rose-500/50 bg-rose-950/30 text-rose-200 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle size={18} className="text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-rose-100">Compiler Execution Error</div>
                <div className="font-mono text-[11px] text-rose-300 leading-relaxed">{compilerError}</div>
              </div>
            </div>
          )}

          {currentTab === 'overview' ? (
            <OverviewView
              onLoadPreset={presetSql => {
                handleLoadPreset(presetSql);
                setCurrentTab('editor');
              }}
              onOpenWorkspace={() => setCurrentTab('editor')}
              onOpenSchema={() => setIsSchemaModalOpen(true)}
            />
          ) : (
            <div className="space-y-6">
              {/* SQL Source Editor */}
              <SqlEditor
                sql={sql}
                onChange={setSql}
                onExecute={() => handleExecute()}
                isCompiling={isCompiling}
                hasErrors={compilerResult?.hasErrors}
                totalTokens={compilerResult?.lexer.tokenCount}
                durationMs={compilerResult?.totalDurationMs}
              />

              {/* Phase Switcher Tabs */}
              <PhaseTabs
                activePhase={activePhase}
                onSelectPhase={setActivePhase}
                result={compilerResult}
              />

              {/* Active Compiler Phase Content */}
              {isCompiling ? (
                <div className="flex flex-col items-center justify-center py-20 rounded-2xl border border-slate-800/80 bg-[#0d131f] space-y-3">
                  <RefreshCw size={24} className="text-cyan-400 animate-spin" />
                  <div className="text-xs font-mono text-slate-400">
                    Executing Lexical, Syntactic, Semantic, IR, and Optimization passes...
                  </div>
                </div>
              ) : compilerResult ? (
                <div className="transition-all duration-200">
                  {activePhase === 'lexer' && (
                    <LexicalPhase lexer={compilerResult.lexer} />
                  )}
                  {activePhase === 'syntax' && (
                    <SyntaxPhase syntax={compilerResult.syntax} />
                  )}
                  {activePhase === 'semantic' && (
                    <SemanticPhase semantic={compilerResult.semantic} />
                  )}
                  {activePhase === 'intermediate' && (
                    <IntermediatePhase intermediate={compilerResult.intermediate} />
                  )}
                  {activePhase === 'optimization' && (
                    <OptimizationPhase optimization={compilerResult.optimization} />
                  )}
                  {activePhase === 'execution' && (
                    <ExecutionPlanPhase executionPlan={compilerResult.executionPlan} />
                  )}
                </div>
              ) : (
                <div className="text-center py-20 text-slate-500 text-xs">
                  Enter a SQL query and click "Run Compiler" to start
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Relational Catalog Modal */}
      <SchemaModal
        isOpen={isSchemaModalOpen}
        onClose={() => setIsSchemaModalOpen(false)}
        catalog={catalog}
      />
    </div>
  );
}
