import { CompilerResult, TableSchema } from '../types/compiler';
import { UNIVERSITY_CATALOG } from './catalog';
import { tokenize } from './lexer';
import { parseSQL } from './parser';
import { analyzeSemantics } from './analyzer';
import { generateIntermediateRepresentation } from './intermediate';
import { optimizeRelationalAlgebra } from './optimizer';
import { generateExecutionPlan } from './executionPlan';

export interface CompilerOptions {
  useRemoteBackend?: boolean;
  backendUrl?: string;
}

export async function compileSQL(
  sql: string,
  catalog: Record<string, TableSchema> = UNIVERSITY_CATALOG,
  options: CompilerOptions = {}
): Promise<CompilerResult> {
  const overallStart = performance.now();

  // If user enabled remote Python Flask backend
  if (options.useRemoteBackend && options.backendUrl) {
    try {
      const response = await fetch(`${options.backendUrl}/api/compile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          query: sql,
          catalog
        })
      });

      if (!response.ok) {
        throw new Error(`Flask backend returned HTTP ${response.status}: ${response.statusText}`);
      }

      const remoteResult = await response.json();
      return {
        ...remoteResult,
        source: 'remote_flask'
      };
    } catch (err: any) {
      console.warn('Flask backend connection failed, falling back to client compiler engine:', err);
      // We throw a descriptive error or flag so UI can notify the user
      throw new Error(`Unable to connect to Flask backend at ${options.backendUrl}. Error: ${err.message}. (Tip: Ensure 'python app.py' is running on port 5000, or switch to the Built-in Simulation Engine).`);
    }
  }

  // Built-in In-Browser Compiler Simulation Engine
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

export const FLASK_BACKEND_STARTER_CODE = `# app.py - Mini SQL Query Compiler Flask Backend
# Compiler Design Lab Starter
# Run: pip install flask flask-cors
# python app.py

import time
import re
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable Cross-Origin Resource Sharing for React frontend

# Keywords definition
KEYWORDS = {
    'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT',
    'ON', 'AS', 'AND', 'OR', 'NOT', 'GROUP', 'BY', 'HAVING',
    'ORDER', 'ASC', 'DESC', 'LIMIT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX'
}

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "healthy",
        "engine": "Python 3.x SQL Compiler",
        "version": "1.0.0"
    })

@app.route('/api/compile', methods=['POST'])
def compile_query():
    start_time = time.time()
    payload = request.get_json(force=True)
    sql = payload.get('query', '')
    catalog = payload.get('catalog', {})

    # 1. Lexical Analysis
    tokens = []
    token_pattern = re.compile(r"(--[^\\n]*|'[^']*'|\\d+(?:\\.\\d+)?|[a-zA-Z_][a-zA-Z0-9_]*|>=|<=|!=|<>|=|>|<|\\+|-|\\*|/|\\(|\\)|,|\\.|;)")
    pos = 0
    token_id = 1
    
    for match in token_pattern.finditer(sql):
        raw = match.group(0)
        ttype = 'IDENTIFIER'
        cat = 'Identifier'
        
        if raw.upper() in KEYWORDS:
            ttype = 'KEYWORD'
            cat = 'Clause' if raw.upper() in ['SELECT', 'FROM', 'WHERE', 'JOIN'] else 'DML'
        elif raw.startswith("'"):
            ttype = 'LITERAL_STRING'
            cat = 'Literal'
        elif raw.isdigit() or re.match(r'^\\d+\\.\\d+$', raw):
            ttype = 'LITERAL_NUMBER'
            cat = 'Literal'
        elif raw in ['>=', '<=', '!=', '<>', '=', '>', '<']:
            ttype = 'OPERATOR'
            cat = 'Comparison'
        elif raw in [',', ';', '(', ')', '.']:
            ttype = 'PUNCTUATION'
            cat = 'Delimiter'

        tokens.append({
            "id": token_id,
            "type": ttype,
            "value": raw,
            "line": sql[:match.start()].count('\\n') + 1,
            "column": match.start() - sql.rfind('\\n', 0, match.start()),
            "regexRule": "token_pattern",
            "category": cat
        })
        token_id += 1

    # 2. Syntax Analysis (AST)
    ast = {
        "id": "root_1",
        "type": "SelectStatement",
        "label": "SelectStatement",
        "grammarRule": "Query -> SELECT ProjectionList FROM TableRef [Clauses]",
        "children": [
            {
                "id": "proj_1",
                "type": "ProjectionList",
                "label": "ProjectionList",
                "grammarRule": "ProjectionList -> Item+",
                "children": []
            }
        ]
    }

    total_time = round((time.time() - start_time) * 1000, 2)

    return jsonify({
        "query": sql,
        "timestamp": time.strftime("%H:%M:%S"),
        "source": "remote_flask",
        "totalDurationMs": total_time,
        "hasErrors": False,
        "lexer": {
            "tokens": tokens,
            "tokenCount": len(tokens),
            "stats": {
                "keywords": sum(1 for t in tokens if t["type"] == "KEYWORD"),
                "identifiers": sum(1 for t in tokens if t["type"] == "IDENTIFIER"),
                "literals": sum(1 for t in tokens if "LITERAL" in t["type"]),
                "operators": sum(1 for t in tokens if t["type"] == "OPERATOR"),
                "punctuations": sum(1 for t in tokens if t["type"] == "PUNCTUATION")
            },
            "durationMs": 0.45,
            "errors": []
        },
        "syntax": {
            "ast": ast,
            "grammarRulesApplied": ["Query -> SELECT Projection FROM Table"],
            "depth": 3,
            "nodeCount": 5,
            "errors": [],
            "durationMs": 0.62
        },
        "semantic": {
            "isValid": True,
            "symbolTable": [],
            "diagnostics": [],
            "resolvedTables": list(catalog.keys()),
            "resolvedColumns": [],
            "durationMs": 0.38
        },
        "intermediate": {
            "algebraTree": {
                "id": "ra_1",
                "op": "PROJECT",
                "symbol": "π",
                "parameters": "*",
                "estimatedRows": 1000,
                "cost": 100,
                "schema": ["*"]
            },
            "algebraText": "π_*(R)",
            "tacInstructions": [
                {"index": 1, "op": "SCAN", "arg1": "students", "result": "t1", "description": "Scan relation"}
            ],
            "durationMs": 0.51
        },
        "optimization": {
            "unoptimizedTree": {"id": "unopt", "op": "PROJECT", "symbol": "π", "parameters": "*", "estimatedRows": 1000, "cost": 100, "schema": []},
            "optimizedTree": {"id": "opt", "op": "PROJECT", "symbol": "π", "parameters": "*", "estimatedRows": 200, "cost": 30, "schema": []},
            "rulesApplied": [
                {
                    "ruleId": "RULE_PREDICATE_PUSHDOWN",
                    "ruleName": "Predicate Pushdown",
                    "category": "Pushdown",
                    "description": "Selection pushed below cross-product.",
                    "target": "Scan",
                    "beforeSnippet": "Join then Filter",
                    "afterSnippet": "Filter then Join",
                    "benefit": "Reduced cardinality by 80%"
                }
            ],
            "metrics": {
                "originalEstimatedCost": 100,
                "optimizedEstimatedCost": 30,
                "costReductionPercent": 70,
                "originalIntermediateTuples": 1000,
                "optimizedIntermediateTuples": 200,
                "tuplesReductionPercent": 80
            },
            "durationMs": 0.8
        },
        "executionPlan": {
            "planTree": {
                "id": "p1",
                "operator": "SeqScan",
                "table": "students",
                "startupCost": 0.0,
                "totalCost": 30.0,
                "estimatedRows": 200,
                "rowWidthBytes": 48
            },
            "totalEstimatedCost": 30.0,
            "peakMemoryKb": 32,
            "explainText": "-> SeqScan on students (cost=0.00..30.00 rows=200 width=48)",
            "durationMs": 0.35
        }
    })

if __name__ == '__main__':
    print("Starting Mini SQL Compiler Flask Server on port 5000...")
    app.run(host='0.0.0.0', port=5000, debug=True)
`;
