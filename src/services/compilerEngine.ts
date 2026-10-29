import { CompilerResult, TableSchema } from '../types/compiler';
import { UNIVERSITY_CATALOG } from './catalog';
import { tokenize } from './lexer';
import { parseSQL } from './parser';
import { analyzeSemantics } from './analyzer';
import { generateIntermediateRepresentation } from './intermediate';
import { optimizeRelationalAlgebra } from './optimizer';
import { generateExecutionPlan } from './executionPlan';

export async function compileSQL(
  sql: string,
  catalog: Record<string, TableSchema> = UNIVERSITY_CATALOG
): Promise<CompilerResult> {
  const overallStart = performance.now();

  // In-Browser Compiler Simulation Engine
  // Phase 1: Lexical Analysis
  const lexer = tokenize(sql);

  // Phase 2: Syntax Analysis & AST Generation
  const syntax = parseSQL(lexer.tokens);

  // Phase 3: Semantic Analysis & Catalog Type Checking
  const semantic = analyzeSemantics(syntax.ast, catalog);

  // Phase 4: Intermediate Representation (Relational Algebra & 3AC)
  const intermediate = generateIntermediateRepresentation(syntax.ast, catalog);

  // Phase 5: Query Optimization
  const optimization = optimizeRelationalAlgebra(intermediate.algebraTree, catalog);

  // Phase 6: Physical Execution Plan Generation
  const executionPlan = generateExecutionPlan(optimization.optimizedTree, catalog);

  const totalDurationMs = parseFloat((performance.now() - overallStart).toFixed(2));
  const hasErrors = lexer.errors.length > 0 || syntax.errors.length > 0 || !semantic.isValid;

  return {
    query: sql,
    timestamp: new Date().toLocaleTimeString(),
    source: 'simulated',
    totalDurationMs,
    hasErrors,
    lexer,
    syntax,
    semantic,
    intermediate,
    optimization,
    executionPlan
  };
}
