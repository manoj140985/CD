"""
Intermediate Representation (IR) Generator for Mini SQL Query Compiler.
Constructs canonical Relational Algebra (RA) operator trees and Linearized Three-Address Code (TAC).
"""

import time
import math
from typing import List, Dict, Any, Optional
from .catalog import UNIVERSITY_CATALOG, get_catalog


def stringify_expr(node: Optional[Dict[str, Any]]) -> str:
    if not node:
        return ""
    ntype = node.get("type")
    if ntype == "BinaryExpression":
        children = node.get("children", [])
        left = stringify_expr(children[0]) if len(children) > 0 else ""
        right = stringify_expr(children[1]) if len(children) > 1 else ""
        return f"{left} {node.get('value', '')} {right}"
    if ntype == "FunctionCall":
        children = node.get("children", [])
        arg = stringify_expr(children[0]) if children else ""
        return f"{node.get('value', '')}({arg})"
    if ntype == "Literal":
        attrs = node.get("attributes", {})
        if attrs.get("rawType") == "VARCHAR":
            return f"'{node.get('value', '')}'"
        return str(node.get("value", ""))
    if ntype == "Identifier":
        return node.get("attributes", {}).get("identifier") or node.get("value") or ""
    if ntype == "Subquery":
        return "(SELECT ...)"
    return node.get("value") or node.get("label") or ""


def build_algebra_string(node: Dict[str, Any]) -> str:
    op = node.get("op")
    symbol = node.get("symbol", "")
    params = node.get("parameters", "")
    children = node.get("children", [])

    if op == "TABLE_SCAN":
        return params
    if len(children) == 1:
        inner = build_algebra_string(children[0])
        return f"{symbol}_{{{params}}}({inner})"
    if len(children) == 2:
        left = build_algebra_string(children[0])
        right = build_algebra_string(children[1])
        return f"({left} {symbol}_{{{params}}} {right})"
    return params


def generate_intermediate(
    ast: Dict[str, Any],
    catalog: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    start_time = time.perf_counter()
    active_catalog = get_catalog(catalog)

    node_id_counter = 1

    def next_id(prefix: str) -> str:
        nonlocal node_id_counter
        nid = f"{prefix}_{node_id_counter}"
        node_id_counter += 1
        return nid

    # Extract elements from AST
    projection_cols: List[str] = []
    from_table: str = "unknown"
    from_alias: str = ""
    joins: List[Dict[str, Any]] = []
    where_condition: str = ""
    group_by_cols: List[str] = []
    aggregate_exprs: List[str] = []
    having_condition: str = ""
    order_by_spec: str = ""
    limit_val: Optional[int] = None

    def traverse(node: Dict[str, Any]) -> None:
        nonlocal from_table, from_alias, where_condition, having_condition, order_by_spec, limit_val
        ntype = node.get("type")

        if ntype == "ProjectionList":
            for c in node.get("children", []):
                if c.get("type") == "ProjectionItem":
                    ch = c.get("children", [])
                    expr = ch[0] if ch else None
                    raw = expr.get("value") or expr.get("label") or c.get("value") or "*" if expr else c.get("value", "*")
                    alias = c.get("attributes", {}).get("alias")
                    projection_cols.append(f"{raw} AS {alias}" if alias else raw)
                    if expr and expr.get("type") == "FunctionCall":
                        aggregate_exprs.append(expr.get("label", ""))

        if ntype == "TableReference" and from_table == "unknown":
            attrs = node.get("attributes", {})
            from_table = (attrs.get("tableName") or node.get("value") or "unknown").lower()
            from_alias = attrs.get("alias") or from_table

        if ntype == "JoinClause":
            children = node.get("children", [])
            target_node = children[0] if len(children) > 0 else {}
            cond_node = children[1] if len(children) > 1 else None

            j_table = (target_node.get("attributes", {}).get("tableName") or target_node.get("value") or "unknown").lower()
            j_alias = target_node.get("attributes", {}).get("alias") or j_table
            cond_str = stringify_expr(cond_node)

            joins.append({
                "table": j_table,
                "alias": j_alias,
                "type": node.get("attributes", {}).get("joinType", "INNER"),
                "condition": cond_str or "TRUE",
            })

        if ntype == "WhereClause":
            children = node.get("children", [])
            if children:
                where_condition = stringify_expr(children[0])

        if ntype == "GroupByClause":
            for c in node.get("children", []):
                group_by_cols.append(stringify_expr(c))

        if ntype == "HavingClause":
            children = node.get("children", [])
            if children:
                having_condition = stringify_expr(children[0])

        if ntype == "OrderByClause":
            items: List[str] = []
            for c in node.get("children", []):
                ch = c.get("children", [])
                e_str = stringify_expr(ch[0]) if ch else ""
                direction = c.get("attributes", {}).get("direction", "ASC")
                items.append(f"{e_str} {direction}")
            order_by_spec = ", ".join(items)

        if ntype == "LimitClause":
            limit_val = node.get("attributes", {}).get("limit")

        for child in node.get("children", []):
            traverse(child)

    traverse(ast)

    if not projection_cols:
        projection_cols = ["*"]

    # 1. Base Table Scan
    base_catalog = active_catalog.get(from_table, {})
    base_rows = base_catalog.get("rowCount", 1000)
    base_cols = [f"{from_alias or from_table}.{c['name']}" for c in base_catalog.get("columns", [])] if base_catalog else ["*"]

    current_subtree: Dict[str, Any] = {
        "id": next_id("scan"),
        "op": "TABLE_SCAN",
        "symbol": "R",
        "parameters": f"{from_table} ({from_alias})" if from_alias and from_alias != from_table else from_table,
        "estimatedRows": base_rows,
        "cost": round(base_rows * 0.1, 1),
        "schema": base_cols,
    }

    # 2. Joins (Unoptimized: direct cross/join above scans)
    for j in joins:
        j_cat = active_catalog.get(j["table"], {})
        j_rows = j_cat.get("rowCount", 500)
        j_cols = [f"{j['alias'] or j['table']}.{c['name']}" for c in j_cat.get("columns", [])] if j_cat else ["*"]

        right_scan = {
            "id": next_id("scan"),
            "op": "TABLE_SCAN",
            "symbol": "R",
            "parameters": f"{j['table']} ({j['alias']})" if j["alias"] and j["alias"] != j["table"] else j["table"],
            "estimatedRows": j_rows,
            "cost": round(j_rows * 0.1, 1),
            "schema": j_cols,
        }

        combined_rows = min(int(current_subtree["estimatedRows"] * j_rows * 0.05), 500000)
        join_cost = round(current_subtree["cost"] + right_scan["cost"] + (current_subtree["estimatedRows"] * j_rows * 0.01), 1)

        current_subtree = {
            "id": next_id("join"),
            "op": "JOIN",
            "symbol": "⨝",
            "parameters": j["condition"],
            "estimatedRows": max(1, combined_rows),
            "cost": join_cost,
            "schema": current_subtree["schema"] + right_scan["schema"],
            "children": [current_subtree, right_scan],
        }

    # 3. Selection (WHERE filter sitting above joins in unoptimized plan)
    if where_condition:
        filtered_rows = max(1, int(current_subtree["estimatedRows"] * 0.15))
        current_subtree = {
            "id": next_id("select"),
            "op": "SELECT",
            "symbol": "σ",
            "parameters": where_condition,
            "estimatedRows": filtered_rows,
            "cost": round(current_subtree["cost"] + current_subtree["estimatedRows"] * 0.05, 1),
            "schema": current_subtree["schema"],
            "children": [current_subtree],
        }

    # 4. Aggregation / Group By
    if group_by_cols or aggregate_exprs:
        group_rows = max(1, int(current_subtree["estimatedRows"] * 0.1)) if group_by_cols else 1
        current_subtree = {
            "id": next_id("agg"),
            "op": "AGGREGATE",
            "symbol": "γ",
            "parameters": f"{', '.join(group_by_cols)}; {', '.join(aggregate_exprs)}",
            "estimatedRows": group_rows,
            "cost": round(current_subtree["cost"] + current_subtree["estimatedRows"] * 0.08, 1),
            "schema": group_by_cols + aggregate_exprs,
            "children": [current_subtree],
        }

    # 5. HAVING
    if having_condition:
        current_subtree = {
            "id": next_id("having"),
            "op": "SELECT",
            "symbol": "σ_having",
            "parameters": having_condition,
            "estimatedRows": max(1, int(current_subtree["estimatedRows"] * 0.5)),
            "cost": round(current_subtree["cost"] + current_subtree["estimatedRows"] * 0.02, 1),
            "schema": current_subtree["schema"],
            "children": [current_subtree],
        }

    # 6. Sort / ORDER BY
    if order_by_spec:
        sort_cost = current_subtree["cost"] + current_subtree["estimatedRows"] * math.log2(max(2, current_subtree["estimatedRows"])) * 0.05
        current_subtree = {
            "id": next_id("sort"),
            "op": "SORT",
            "symbol": "τ",
            "parameters": order_by_spec,
            "estimatedRows": current_subtree["estimatedRows"],
            "cost": round(sort_cost, 1),
            "schema": current_subtree["schema"],
            "children": [current_subtree],
        }

    # 7. Projection (Topmost in canonical plan)
    current_subtree = {
        "id": next_id("proj"),
        "op": "PROJECT",
        "symbol": "π",
        "parameters": ", ".join(projection_cols),
        "estimatedRows": current_subtree["estimatedRows"],
        "cost": round(current_subtree["cost"] + current_subtree["estimatedRows"] * 0.01, 1),
        "schema": projection_cols,
        "children": [current_subtree],
    }

    # 8. LIMIT
    if limit_val is not None:
        current_subtree = {
            "id": next_id("limit"),
            "op": "LIMIT",
            "symbol": "λ",
            "parameters": f"limit: {limit_val}",
            "estimatedRows": min(current_subtree["estimatedRows"], limit_val),
            "cost": current_subtree["cost"],
            "schema": current_subtree["schema"],
            "children": [current_subtree],
        }

    algebra_text = build_algebra_string(current_subtree)

    # 9. Linear Three-Address Code (TAC) Generation
    tac_instructions: List[Dict[str, Any]] = []
    temp_counter = 1

    def generate_tac(node: Dict[str, Any]) -> str:
        nonlocal temp_counter
        children = node.get("children", [])
        c1 = generate_tac(children[0]) if len(children) > 0 else ""
        c2 = generate_tac(children[1]) if len(children) > 1 else ""

        res = f"t{temp_counter}"
        temp_counter += 1
        op = node.get("op")
        params = node.get("parameters", "")

        if op == "TABLE_SCAN":
            tac_instructions.append({
                "index": len(tac_instructions) + 1,
                "op": "SCAN",
                "arg1": params,
                "result": res,
                "description": f"Sequential or base relation scan of table {params}",
            })
        elif op == "JOIN":
            tac_instructions.append({
                "index": len(tac_instructions) + 1,
                "op": "JOIN",
                "arg1": c1,
                "arg2": f"{c2} ON ({params})",
                "result": res,
                "description": f"Relational join of {c1} and {c2} with join predicate",
            })
        elif op == "SELECT":
            tac_instructions.append({
                "index": len(tac_instructions) + 1,
                "op": "FILTER",
                "arg1": c1,
                "arg2": params,
                "result": res,
                "description": f"Filter tuples in {c1} satisfying ({params})",
            })
        elif op == "AGGREGATE":
            tac_instructions.append({
                "index": len(tac_instructions) + 1,
                "op": "GROUP_AGG",
                "arg1": c1,
                "arg2": params,
                "result": res,
                "description": f"Aggregate and group intermediate relation {c1}",
            })
        elif op == "SORT":
            tac_instructions.append({
                "index": len(tac_instructions) + 1,
                "op": "SORT",
                "arg1": c1,
                "arg2": params,
                "result": res,
                "description": f"Sort intermediate relation {c1} by {params}",
            })
        elif op == "PROJECT":
            tac_instructions.append({
                "index": len(tac_instructions) + 1,
                "op": "PROJECT",
                "arg1": c1,
                "arg2": f"[{params}]",
                "result": res,
                "description": f"Project selected attributes from {c1}",
            })
        elif op == "LIMIT":
            tac_instructions.append({
                "index": len(tac_instructions) + 1,
                "op": "LIMIT",
                "arg1": c1,
                "arg2": params,
                "result": res,
                "description": f"Truncate result stream to {params}",
            })

        return res

    final_temp = generate_tac(current_subtree)
    tac_instructions.append({
        "index": len(tac_instructions) + 1,
        "op": "RETURN",
        "arg1": final_temp,
        "result": "OUTPUT_STREAM",
        "description": f"Emit resulting tuple stream {final_temp} to caller",
    })

    duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

    return {
        "algebraTree": current_subtree,
        "algebraText": algebra_text,
        "tacInstructions": tac_instructions,
        "durationMs": duration_ms,
    }
