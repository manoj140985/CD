"""
Semantic Analyzer and Catalog Validator for Mini SQL Query Compiler.
Performs table resolution, column disambiguation, type checking, and symbol table generation.
"""

import time
from typing import List, Dict, Any, Optional, Set
from .catalog import UNIVERSITY_CATALOG, get_catalog


def analyze_semantics(
    ast: Dict[str, Any],
    catalog: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    start_time = time.perf_counter()
    active_catalog = get_catalog(catalog)

    diagnostics: List[Dict[str, Any]] = []
    symbol_table: List[Dict[str, Any]] = []
    table_bindings: Dict[str, Dict[str, Any]] = {}
    resolved_tables: Set[str] = set()
    resolved_columns: Set[str] = set()

    diag_counter = 1

    def add_diag(
        severity: str,
        code: str,
        message: str,
        line: Optional[int] = None,
        column: Optional[int] = None,
        hint: Optional[str] = None
    ) -> None:
        nonlocal diag_counter
        diagnostics.append({
            "id": f"diag_{diag_counter}",
            "severity": severity,
            "code": code,
            "message": message,
            "line": line or 1,
            "column": column or 1,
            "hint": hint,
        })
        diag_counter += 1

    # 1. Gather all TableReference nodes
    table_nodes: List[Dict[str, Any]] = []

    def find_tables(node: Dict[str, Any]) -> None:
        if node.get("type") == "TableReference":
            table_nodes.append(node)
        for child in node.get("children", []):
            find_tables(child)

    find_tables(ast)

    if not table_nodes:
        add_diag(
            "error",
            "ERR_MISSING_TABLE",
            "Query does not specify any table in the FROM clause.",
            1,
            1,
            "Add a FROM clause with a valid table name"
        )

    for t_node in table_nodes:
        attrs = t_node.get("attributes", {})
        raw_table = (attrs.get("tableName") or t_node.get("value") or "").lower()
        alias = (attrs.get("alias") or raw_table).lower()
        schema = active_catalog.get(raw_table)

        line = t_node.get("line", 1)
        col = t_node.get("column", 1)

        if not schema:
            available = ", ".join(active_catalog.keys())
            add_diag(
                "error",
                "ERR_TABLE_NOT_FOUND",
                f"Table '{raw_table}' does not exist in relational catalog.",
                line,
                col,
                f"Available catalog tables: {available}"
            )
        else:
            resolved_tables.add(raw_table)
            symbol_table.append({
                "name": raw_table,
                "category": "TABLE",
                "dataType": "RELATION",
                "scope": "GLOBAL",
                "isNullable": False,
                "sourceLine": line,
            })

        if alias != raw_table:
            symbol_table.append({
                "name": alias,
                "category": "ALIAS",
                "dataType": f"ALIAS_OF({raw_table})",
                "scope": "QUERY",
                "resolvedTable": raw_table,
                "isNullable": False,
                "sourceLine": line,
            })

        table_bindings[alias] = {"alias": alias, "tableName": raw_table, "schema": schema}
        if raw_table not in table_bindings:
            table_bindings[raw_table] = {"alias": alias, "tableName": raw_table, "schema": schema}

    # 2. Gather and validate all Identifier nodes (columns)
    identifier_nodes: List[Dict[str, Any]] = []

    def find_identifiers(node: Dict[str, Any]) -> None:
        if node.get("type") == "Identifier":
            identifier_nodes.append(node)
        for child in node.get("children", []):
            find_identifiers(child)

    find_identifiers(ast)

    for id_node in identifier_nodes:
        attrs = id_node.get("attributes", {})
        raw_id = attrs.get("identifier") or id_node.get("value") or ""
        parts = raw_id.split(".")
        line = id_node.get("line", 1)
        col = id_node.get("column", 1)

        if len(parts) == 2:
            qualifier = parts[0].lower()
            col_name = parts[1].lower()

            binding = table_bindings.get(qualifier)
            if not binding:
                add_diag(
                    "error",
                    "ERR_UNKNOWN_TABLE_ALIAS",
                    f"Unknown table or alias qualifier '{qualifier}' in '{raw_id}'.",
                    line,
                    col,
                    f"Did you forget to add '{qualifier}' to the FROM or JOIN clause?"
                )
            elif binding.get("schema"):
                cols = binding["schema"].get("columns", [])
                col_def = next((c for c in cols if c["name"].lower() == col_name), None)
                if not col_def and col_name != "*":
                    avail_cols = ", ".join(c["name"] for c in cols)
                    add_diag(
                        "error",
                        "ERR_COLUMN_NOT_FOUND",
                        f"Column '{col_name}' not found in table '{binding['tableName']}'.",
                        line,
                        col,
                        f"Available columns in '{binding['tableName']}': {avail_cols}"
                    )
                elif col_def:
                    resolved_columns.add(f"{binding['tableName']}.{col_def['name']}")
                    symbol_table.append({
                        "name": raw_id,
                        "category": "COLUMN",
                        "dataType": col_def["type"],
                        "scope": qualifier,
                        "resolvedTable": binding["tableName"],
                        "isNullable": col_def.get("nullable", True),
                        "sourceLine": line,
                    })
        elif len(parts) == 1 and raw_id != "*":
            col_name = parts[0].lower()
            matching_bindings: List[Dict[str, Any]] = []

            seen_tables: Set[str] = set()
            for binding in table_bindings.values():
                if binding.get("schema") and binding["tableName"] not in seen_tables:
                    seen_tables.add(binding["tableName"])
                    cols = binding["schema"].get("columns", [])
                    cdef = next((c for c in cols if c["name"].lower() == col_name), None)
                    if cdef:
                        matching_bindings.append({
                            "binding": binding,
                            "type": cdef["type"],
                            "nullable": cdef.get("nullable", True)
                        })

            if not matching_bindings:
                if resolved_tables:
                    add_diag(
                        "error",
                        "ERR_COLUMN_NOT_FOUND",
                        f"Unqualified column '{col_name}' does not exist in any referenced table.",
                        line,
                        col,
                        f"Check spelling or prefix with table alias (e.g., s.{col_name})"
                    )
            elif len(matching_bindings) > 1:
                tbl_list = ", ".join(m["binding"]["tableName"] for m in matching_bindings)
                first_alias = matching_bindings[0]["binding"]["alias"]
                add_diag(
                    "error",
                    "ERR_AMBIGUOUS_COLUMN",
                    f"Column '{col_name}' is ambiguous; it exists in tables: {tbl_list}.",
                    line,
                    col,
                    f"Disambiguate by prefixing the column with the table alias (e.g., {first_alias}.{col_name})"
                )
            else:
                match = matching_bindings[0]
                t_name = match["binding"]["tableName"]
                resolved_columns.add(f"{t_name}.{col_name}")
                symbol_table.append({
                    "name": col_name,
                    "category": "COLUMN",
                    "dataType": match["type"],
                    "scope": t_name,
                    "resolvedTable": t_name,
                    "isNullable": match["nullable"],
                    "sourceLine": line,
                })

    # 3. Type Checking in Binary Expressions
    def is_numeric_expr(n: Dict[str, Any]) -> bool:
        if n.get("type") == "Literal" and n.get("attributes", {}).get("rawType") == "INT_OR_FLOAT":
            return True
        if n.get("type") == "Identifier":
            raw = n.get("attributes", {}).get("identifier") or n.get("value") or ""
            p = raw.split(".")
            if len(p) == 2:
                b = table_bindings.get(p[0].lower())
                if b and b.get("schema"):
                    c = next((x for x in b["schema"].get("columns", []) if x["name"].lower() == p[1].lower()), None)
                    return c is not None and c.get("type") in ("INT", "FLOAT")
        return False

    def check_types(node: Dict[str, Any]) -> None:
        if node.get("type") == "BinaryExpression" and node.get("value") in (">", "<", ">=", "<=", "=", "!=", "<>"):
            children = node.get("children", [])
            if len(children) == 2:
                left, right = children[0], children[1]
                is_left_num = is_numeric_expr(left)
                is_right_str = right.get("type") == "Literal" and right.get("attributes", {}).get("rawType") == "VARCHAR"

                if is_left_num and is_right_str:
                    add_diag(
                        "warning",
                        "WARN_TYPE_MISMATCH",
                        f"Type mismatch in comparison '{node.get('value')}': comparing numeric attribute with string literal '{right.get('value')}'.",
                        right.get("line") or node.get("line", 1),
                        right.get("column") or node.get("column", 1),
                        "SQL engine will attempt implicit string-to-numeric coercion, which may cause runtime execution failure."
                    )
        for child in node.get("children", []):
            check_types(child)

    check_types(ast)

    # 4. Aggregate & GROUP BY validation
    has_aggregates = False
    has_group_by = False
    non_agg_select_cols: List[str] = []

    def inspect_aggregates(node: Dict[str, Any]) -> None:
        nonlocal has_aggregates, has_group_by
        if node.get("type") == "FunctionCall":
            has_aggregates = True
        if node.get("type") == "GroupByClause":
            has_group_by = True
        if node.get("type") == "ProjectionItem":
            ch = node.get("children", [])
            if ch and ch[0].get("type") == "Identifier":
                non_agg_select_cols.append(ch[0].get("value", "").lower())
        for child in node.get("children", []):
            inspect_aggregates(child)

    inspect_aggregates(ast)

    if has_aggregates and not has_group_by and non_agg_select_cols:
        target_col = non_agg_select_cols[0]
        add_diag(
            "error",
            "ERR_AGGREGATE_WITHOUT_GROUP_BY",
            f"Column '{target_col}' must appear in the GROUP BY clause or be used in an aggregate function.",
            1,
            1,
            f"Add 'GROUP BY {', '.join(non_agg_select_cols)}' or wrap '{target_col}' in an aggregate function"
        )

    # 5. Index Advisory Info
    for res_col in resolved_columns:
        t_name, c_name = res_col.split(".", 1)
        tbl = active_catalog.get(t_name)
        if tbl:
            col_obj = next((c for c in tbl.get("columns", []) if c["name"].lower() == c_name.lower()), None)
            if col_obj and col_obj.get("indexed"):
                diagnostics.append({
                    "id": f"diag_info_{diag_counter}",
                    "severity": "info",
                    "code": "INFO_INDEX_AVAILABLE",
                    "message": f"Indexed attribute detected: '{res_col}' has a B-Tree index defined in catalog.",
                    "line": 1,
                    "column": 1,
                    "hint": "Can be used by execution engine for Index Scan.",
                })
                diag_counter += 1
                break

    duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
    has_errors = any(d["severity"] == "error" for d in diagnostics)

    return {
        "isValid": not has_errors,
        "symbolTable": symbol_table,
        "diagnostics": diagnostics,
        "resolvedTables": sorted(list(resolved_tables)),
        "resolvedColumns": sorted(list(resolved_columns)),
        "durationMs": duration_ms,
    }
