"""
Compiler Engine Orchestrator for Mini SQL Query Compiler.
Coordinates Lexing, Parsing, Semantic Validation, Intermediate Representation,
Optimization, and Execution Planning.
"""

import time
from typing import Dict, Any, Optional

from .catalog import get_catalog
from .lexer import tokenize
from .parser import parse_sql
from .analyzer import analyze_semantics
from .intermediate import generate_intermediate
from .optimizer import optimize_query
from .execution_plan import generate_execution_plan


class CompilerEngine:
    def __init__(self, catalog: Optional[Dict[str, Any]] = None):
        self.catalog = get_catalog(catalog)

    def compile(self, query: str, custom_catalog: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        overall_start = time.perf_counter()
        catalog_to_use = get_catalog(custom_catalog or self.catalog)

        # 1. Lexical Analysis
        lexer_res = tokenize(query)

        # 2. Syntax Analysis & AST Generation
        syntax_res = parse_sql(lexer_res["tokens"])

        # 3. Semantic Analysis
        semantic_res = analyze_semantics(syntax_res["ast"], catalog_to_use)

        # 4. Intermediate Representation
        intermediate_res = generate_intermediate(syntax_res["ast"], catalog_to_use)

        # 5. Query Optimization
        optimization_res = optimize_query(intermediate_res["algebraTree"], catalog_to_use)

        # 6. Physical Execution Plan
        execution_plan_res = generate_execution_plan(optimization_res["optimizedTree"], catalog_to_use)

        total_duration_ms = round((time.perf_counter() - overall_start) * 1000, 2)
        has_errors = (
            len(lexer_res.get("errors", [])) > 0
            or len(syntax_res.get("errors", [])) > 0
            or not semantic_res.get("isValid", True)
        )

        return {
            "query": query,
            "timestamp": time.strftime("%H:%M:%S"),
            "source": "remote_flask",
            "totalDurationMs": total_duration_ms,
            "hasErrors": has_errors,
            "lexer": lexer_res,
            "syntax": syntax_res,
            "semantic": semantic_res,
            "intermediate": intermediate_res,
            "optimization": optimization_res,
            "executionPlan": execution_plan_res,
        }


def compile_sql(query: str, catalog: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Convenience helper to compile an SQL query."""
    engine = CompilerEngine(catalog)
    return engine.compile(query, catalog)
