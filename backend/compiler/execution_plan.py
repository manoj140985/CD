"""
Physical Execution Plan Generator for Mini SQL Query Compiler.
Synthesizes physical pipeline operator trees (Volcano iterator model) and PostgreSQL-compatible EXPLAIN output.
"""

import re
import time
from typing import Dict, Any, Optional, List
from .catalog import UNIVERSITY_CATALOG, get_catalog


def generate_execution_plan(
    optimized_tree: Dict[str, Any],
    catalog: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    start_time = time.perf_counter()
    active_catalog = get_catalog(catalog)

    node_counter = 1

    def next_id(prefix: str) -> str:
        nonlocal node_counter
        nid = f"phys_{prefix}_{node_counter}"
        node_counter += 1
        return nid

    def convert_node(node: Dict[str, Any]) -> Dict[str, Any]:
        children = [convert_node(c) for c in node.get("children", [])]
        op = node.get("op")
        params = node.get("parameters", "")
        est_rows = int(node.get("estimatedRows", 100))

        if op == "TABLE_SCAN":
            # Extract raw table name
            m = re.search(r"\((.*?)\)", params)
            raw_table = (m.group(1) if m else params.split()[0]).lower()
            base_tbl = active_catalog.get(raw_table, {})
            cols = base_tbl.get("columns", [])
            is_indexed = any(c.get("indexed") for c in cols)
            row_count = base_tbl.get("rowCount", 0)

            if is_indexed and row_count > 1000:
                return {
                    "id": next_id("idx_scan"),
                    "operator": "IndexScan",
                    "table": params,
                    "indexUsed": f"idx_{raw_table}_pk",
                    "condition": "Index Cond: (id = ?)",
                    "startupCost": 0.28,
                    "totalCost": round(est_rows * 0.08 + 12, 2),
                    "estimatedRows": est_rows,
                    "rowWidthBytes": 64,
                    "memoryKb": 32,
                }
            return {
                "id": next_id("seq_scan"),
                "operator": "SeqScan",
                "table": params,
                "startupCost": 0.00,
                "totalCost": round(est_rows * 0.15 + 5, 2),
                "estimatedRows": est_rows,
                "rowWidthBytes": 72,
                "memoryKb": 16,
            }

        elif op == "SELECT":
            child_cost = children[0]["totalCost"] if children else 10.0
            child_width = children[0]["rowWidthBytes"] if children else 64
            res = {
                "id": next_id("filter"),
                "operator": "Filter",
                "condition": params,
                "startupCost": children[0]["startupCost"] if children else 0.0,
                "totalCost": round(child_cost + est_rows * 0.02, 2),
                "estimatedRows": est_rows,
                "rowWidthBytes": child_width,
            }
            if children:
                res["children"] = children
            return res

        elif op == "JOIN":
            left = children[0] if len(children) > 0 else {}
            right = children[1] if len(children) > 1 else {}
            left_cost = left.get("totalCost", 10.0)
            right_cost = right.get("totalCost", 10.0)
            left_rows = left.get("estimatedRows", 10)
            right_rows = right.get("estimatedRows", 10)
            row_width = left.get("rowWidthBytes", 40) + right.get("rowWidthBytes", 40)

            if left_rows > 100 or right_rows > 100:
                res = {
                    "id": next_id("hash_join"),
                    "operator": "HashJoin",
                    "condition": f"Hash Cond: ({params})",
                    "startupCost": round(right_cost + 15, 2),
                    "totalCost": round(left_cost + right_cost + est_rows * 0.04 + 25, 2),
                    "estimatedRows": est_rows,
                    "rowWidthBytes": row_width,
                    "memoryKb": max(64, int(right_rows * 0.12)),
                }
            else:
                res = {
                    "id": next_id("nested_loop"),
                    "operator": "NestedLoopJoin",
                    "condition": f"Join Filter: ({params})",
                    "startupCost": 0.00,
                    "totalCost": round(left_cost + (left_rows * right_cost * 0.1), 2),
                    "estimatedRows": est_rows,
                    "rowWidthBytes": row_width,
                    "memoryKb": 16,
                }
            if children:
                res["children"] = children
            return res

        elif op == "AGGREGATE":
            child_cost = children[0]["totalCost"] if children else 20.0
            res = {
                "id": next_id("hash_agg"),
                "operator": "HashAggregate",
                "condition": f"Group Key: {params}",
                "startupCost": child_cost,
                "totalCost": round(child_cost + est_rows * 0.08 + 15, 2),
                "estimatedRows": est_rows,
                "rowWidthBytes": 48,
                "memoryKb": 128,
            }
            if children:
                res["children"] = children
            return res

        elif op == "SORT":
            child_cost = children[0]["totalCost"] if children else 20.0
            res = {
                "id": next_id("sort"),
                "operator": "Sort",
                "condition": f"Sort Key: {params}",
                "startupCost": round(child_cost + est_rows * 0.04, 2),
                "totalCost": round(child_cost + est_rows * 0.09 + 8, 2),
                "estimatedRows": est_rows,
                "rowWidthBytes": children[0]["rowWidthBytes"] if children else 56,
                "memoryKb": max(32, int(est_rows * 0.08)),
            }
            if children:
                res["children"] = children
            return res

        elif op == "LIMIT":
            child_cost = children[0]["totalCost"] if children else 20.0
            res = {
                "id": next_id("limit"),
                "operator": "Limit",
                "condition": params,
                "startupCost": children[0]["startupCost"] if children else 0.0,
                "totalCost": round(child_cost * 0.6, 2),
                "estimatedRows": est_rows,
                "rowWidthBytes": children[0]["rowWidthBytes"] if children else 56,
            }
            if children:
                res["children"] = children
            return res

        # Default PROJECT: pass through child or emit SeqScan
        if children:
            return children[0]
        return {
            "id": next_id("proj"),
            "operator": "SeqScan",
            "table": "ResultStream",
            "startupCost": 0.0,
            "totalCost": 10.0,
            "estimatedRows": est_rows,
            "rowWidthBytes": 40,
        }

    plan_tree = convert_node(optimized_tree)
    total_cost = plan_tree.get("totalCost", 10.0)

    # Calculate peak memory
    peak_memory = 32

    def check_mem(n: Dict[str, Any]) -> None:
        nonlocal peak_memory
        mem = n.get("memoryKb")
        if mem and mem > peak_memory:
            peak_memory = mem
        for child in n.get("children", []):
            check_mem(child)

    check_mem(plan_tree)

    # Format EXPLAIN text
    explain_lines: List[str] = []

    def build_explain(node: Dict[str, Any], indent: int = 0) -> None:
        spaces = "  " * indent
        op_name = node.get("operator", "Operator")
        tbl = node.get("table")
        startup = node.get("startupCost", 0.0)
        tot = node.get("totalCost", 0.0)
        rows = node.get("estimatedRows", 0)
        width = node.get("rowWidthBytes", 0)

        cost_str = f"(cost={startup:.2f}..{tot:.2f} rows={rows} width={width})"
        line = f"{spaces}->  {op_name}"
        if tbl:
            line += f" on {tbl}"
        line += f"  {cost_str}"
        explain_lines.append(line)

        if node.get("indexUsed"):
            explain_lines.append(f"{spaces}    Index Used: {node['indexUsed']}")
        if node.get("condition"):
            explain_lines.append(f"{spaces}    {node['condition']}")
        if node.get("memoryKb"):
            explain_lines.append(f"{spaces}    Peak WorkMem: {node['memoryKb']} kB")

        for child in node.get("children", []):
            build_explain(child, indent + 1)

    build_explain(plan_tree)
    planning_time = round((time.perf_counter() - start_time) * 1000 + 0.15, 3)
    explain_lines.append("")
    explain_lines.append(f"Planning Time: {planning_time:.3f} ms")
    explain_lines.append("Execution Engine: Volcano Pipeline Iterator (Pull-based)")
    explain_lines.append("JIT Compilation: Available (Cost Threshold = 100,000)")

    duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

    return {
        "planTree": plan_tree,
        "totalEstimatedCost": total_cost,
        "peakMemoryKb": peak_memory,
        "explainText": "\n".join(explain_lines),
        "durationMs": duration_ms,
    }
