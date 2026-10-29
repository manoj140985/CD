export type TokenType =
  | 'KEYWORD'
  | 'IDENTIFIER'
  | 'LITERAL_STRING'
  | 'LITERAL_NUMBER'
  | 'OPERATOR'
  | 'PUNCTUATION'
  | 'COMMENT'
  | 'UNKNOWN';

export interface Token {
  id: number;
  type: TokenType;
  value: string;
  line: number;
  column: number;
  regexRule: string;
  category: 'DML' | 'Clause' | 'Identifier' | 'Literal' | 'Comparison' | 'Logical' | 'Delimiter' | 'Other';
}

export interface LexerResult {
  tokens: Token[];
  tokenCount: number;
  stats: {
    keywords: number;
    identifiers: number;
    literals: number;
    operators: number;
    punctuations: number;
  };
  durationMs: number;
  errors: string[];
}

export type ASTNodeType =
  | 'SelectStatement'
  | 'ProjectionList'
  | 'ProjectionItem'
  | 'TableReference'
  | 'JoinClause'
  | 'WhereClause'
  | 'BinaryExpression'
  | 'UnaryExpression'
  | 'Identifier'
  | 'Literal'
  | 'FunctionCall'
  | 'GroupByClause'
  | 'HavingClause'
  | 'OrderByClause'
  | 'OrderByItem'
  | 'LimitClause'
  | 'Subquery';

export interface ASTNode {
  id: string;
  type: ASTNodeType;
  label: string;
  value?: string;
  grammarRule: string;
  attributes?: Record<string, any>;
  children?: ASTNode[];
  line?: number;
  column?: number;
}

export interface SyntaxResult {
  ast: ASTNode;
  grammarRulesApplied: string[];
  depth: number;
  nodeCount: number;
  errors: {
    message: string;
    line: number;
    column: number;
    expectedToken?: string;
    foundToken?: string;
    suggestion?: string;
  }[];
  durationMs: number;
}

export interface ColumnSchema {
  name: string;
  type: 'INT' | 'VARCHAR' | 'FLOAT' | 'DATE' | 'BOOLEAN';
  nullable: boolean;
  isPrimary?: boolean;
  isForeign?: boolean;
  references?: { table: string; column: string };
  indexed?: boolean;
}

export interface TableSchema {
  name: string;
  rowCount: number;
  columns: ColumnSchema[];
  primaryKey: string;
}

export interface SymbolTableEntry {
  name: string;
  category: 'TABLE' | 'COLUMN' | 'ALIAS' | 'FUNCTION';
  dataType: string;
  scope: string;
  resolvedTable?: string;
  isNullable: boolean;
  sourceLine: number;
}

export interface Diagnostic {
  id: string;
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  line?: number;
  column?: number;
  hint?: string;
}

export interface SemanticResult {
  isValid: boolean;
  symbolTable: SymbolTableEntry[];
  diagnostics: Diagnostic[];
  resolvedTables: string[];
  resolvedColumns: string[];
  durationMs: number;
}

export type RelationalOperatorType =
  | 'PROJECT'        // Pi π
  | 'SELECT'         // Sigma σ
  | 'JOIN'           // Bowtie ⨝
  | 'TABLE_SCAN'     // R
  | 'AGGREGATE'      // Gamma γ
  | 'SORT'           // Tau τ
  | 'LIMIT';         // Lambda λ

export interface RelationalAlgebraNode {
  id: string;
  op: RelationalOperatorType;
  symbol: string;
  parameters: string;
  estimatedRows: number;
  cost: number;
  schema: string[];
  children?: RelationalAlgebraNode[];
}

export interface TACInstruction {
  index: number;
  op: string;
  arg1?: string;
  arg2?: string;
  result: string;
  description: string;
}

export interface IntermediateResult {
  algebraTree: RelationalAlgebraNode;
  algebraText: string;
  tacInstructions: TACInstruction[];
  durationMs: number;
}

export interface OptimizationRuleApplication {
  ruleId: string;
  ruleName: string;
  category: 'Pushdown' | 'Simplification' | 'Reordering' | 'Pruning';
  description: string;
  target: string;
  beforeSnippet: string;
  afterSnippet: string;
  benefit: string;
}

export interface OptimizationResult {
  unoptimizedTree: RelationalAlgebraNode;
  optimizedTree: RelationalAlgebraNode;
  rulesApplied: OptimizationRuleApplication[];
  metrics: {
    originalEstimatedCost: number;
    optimizedEstimatedCost: number;
    costReductionPercent: number;
    originalIntermediateTuples: number;
    optimizedIntermediateTuples: number;
    tuplesReductionPercent: number;
  };
  durationMs: number;
}

export type PhysicalOperatorType =
  | 'SeqScan'
  | 'IndexScan'
  | 'HashJoin'
  | 'NestedLoopJoin'
  | 'SortMergeJoin'
  | 'Filter'
  | 'HashAggregate'
  | 'Sort'
  | 'Limit';

export interface PhysicalOperatorNode {
  id: string;
  operator: PhysicalOperatorType;
  table?: string;
  condition?: string;
  projection?: string[];
  startupCost: number;
  totalCost: number;
  estimatedRows: number;
  rowWidthBytes: number;
  memoryKb?: number;
  indexUsed?: string;
  children?: PhysicalOperatorNode[];
}

export interface ExecutionPlanResult {
  planTree: PhysicalOperatorNode;
  totalEstimatedCost: number;
  peakMemoryKb: number;
  explainText: string;
  durationMs: number;
}

export interface CompilerResult {
  query: string;
  timestamp: string;
  source: 'simulated' | 'remote_flask';
  totalDurationMs: number;
  hasErrors: boolean;
  lexer: LexerResult;
  syntax: SyntaxResult;
  semantic: SemanticResult;
  intermediate: IntermediateResult;
  optimization: OptimizationResult;
  executionPlan: ExecutionPlanResult;
}
