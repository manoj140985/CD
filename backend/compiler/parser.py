"""
Recursive Descent Parser and Abstract Syntax Tree (AST) Generator for SQL.
Implements Context-Free Grammar (CFG) validation with line/column error tracking.
"""

import time
from typing import List, Dict, Any, Optional, Set


class SQLParser:
    def __init__(self, tokens: List[Dict[str, Any]]):
        # Exclude comments from parser input
        self.tokens = [t for t in tokens if t.get("type") != "COMMENT"]
        self.current = 0
        self.grammar_rules_applied: Set[str] = set()
        self.errors: List[Dict[str, Any]] = []
        self.node_id_counter = 1

    def next_id(self, prefix: str = "node") -> str:
        nid = f"{prefix}_{self.node_id_counter}"
        self.node_id_counter += 1
        return nid

    def peek(self) -> Optional[Dict[str, Any]]:
        if self.current < len(self.tokens):
            return self.tokens[self.current]
        return None

    def previous(self) -> Dict[str, Any]:
        return self.tokens[self.current - 1]

    def is_at_end(self) -> bool:
        if self.current >= len(self.tokens):
            return True
        tok = self.peek()
        return tok is not None and tok.get("value") == ";"

    def check(self, value: str, token_type: Optional[str] = None) -> bool:
        if self.is_at_end():
            return False
        tok = self.peek()
        if not tok:
            return False
        if token_type and tok.get("type") != token_type:
            return False
        return tok.get("value", "").upper() == value.upper()

    def match(self, *values: str) -> bool:
        for val in values:
            if self.check(val):
                self.advance()
                return True
        return False

    def advance(self) -> Dict[str, Any]:
        if not self.is_at_end():
            self.current += 1
        return self.previous()

    def consume(self, expected_value: str, message: str) -> Dict[str, Any]:
        if self.check(expected_value):
            return self.advance()
        token = self.peek()
        line = token["line"] if token else 1
        column = token["column"] if token else 1
        found_token = token["value"] if token else "EOF"

        self.errors.append({
            "message": message,
            "line": line,
            "column": column,
            "expectedToken": expected_value,
            "foundToken": found_token,
            "suggestion": f"Add '{expected_value}' before '{found_token}'",
        })

        return {
            "id": -1,
            "type": "KEYWORD",
            "value": expected_value,
            "line": line,
            "column": column,
            "regexRule": "synthetic",
            "category": "Clause",
        }

    def parse(self) -> Dict[str, Any]:
        start_time = time.perf_counter()
        self.grammar_rules_applied.add(
            "QueryStatement -> SELECT ProjectionClause FROM TableClause [JoinClauses] [WhereClause] [GroupByClause] [OrderByClause] [LimitClause]"
        )

        if not self.check("SELECT"):
            first_tok = self.peek()
            self.errors.append({
                "message": f"Expected 'SELECT' at start of query, found '{first_tok['value'] if first_tok else 'EOF'}'",
                "line": first_tok["line"] if first_tok else 1,
                "column": first_tok["column"] if first_tok else 1,
                "expectedToken": "SELECT",
                "foundToken": first_tok["value"] if first_tok else "EOF",
                "suggestion": "Start your query with 'SELECT <columns> FROM <table>'",
            })
            ast_root = {
                "id": self.next_id("error_root"),
                "type": "SelectStatement",
                "label": "SelectStatement (Incomplete)",
                "grammarRule": "QueryStatement -> <SyntaxError>",
                "children": [],
            }
        else:
            ast_root = self.parse_select_statement()

        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        depth = self.calculate_depth(ast_root)
        node_count = self.count_nodes(ast_root)

        return {
            "ast": ast_root,
            "grammarRulesApplied": sorted(list(self.grammar_rules_applied)),
            "depth": depth,
            "nodeCount": node_count,
            "errors": self.errors,
            "durationMs": duration_ms,
        }

    def parse_select_statement(self) -> Dict[str, Any]:
        self.consume("SELECT", "Expected 'SELECT'")
        self.grammar_rules_applied.add("SelectClause -> SELECT [DISTINCT] ProjectionList")

        is_distinct = False
        if self.match("DISTINCT"):
            is_distinct = True

        projection_list_node = self.parse_projection_list()

        from_node: Optional[Dict[str, Any]] = None
        joins: List[Dict[str, Any]] = []

        if self.match("FROM"):
            self.grammar_rules_applied.add("FromClause -> FROM TableReference [JoinClause*]")
            from_node = self.parse_table_reference()

            while self.check("JOIN") or self.check("INNER") or self.check("LEFT") or self.check("RIGHT"):
                join_type = "INNER"
                if self.match("INNER"):
                    self.consume("JOIN", "Expected 'JOIN' after 'INNER'")
                elif self.match("LEFT"):
                    self.match("OUTER")
                    self.consume("JOIN", "Expected 'JOIN' after 'LEFT'")
                    join_type = "LEFT"
                elif self.match("RIGHT"):
                    self.match("OUTER")
                    self.consume("JOIN", "Expected 'JOIN' after 'RIGHT'")
                    join_type = "RIGHT"
                else:
                    self.consume("JOIN", "Expected 'JOIN'")

                self.grammar_rules_applied.add(f"JoinClause -> {join_type} JOIN TableReference ON Condition")
                joined_table = self.parse_table_reference()

                on_cond_node: Optional[Dict[str, Any]] = None
                if self.match("ON"):
                    on_cond_node = self.parse_expression()

                join_children = [joined_table]
                if on_cond_node:
                    join_children.append(on_cond_node)

                joins.append({
                    "id": self.next_id("join"),
                    "type": "JoinClause",
                    "label": f"{join_type} JOIN",
                    "grammarRule": f"JoinClause -> {join_type} JOIN TableRef ON Expression",
                    "attributes": {"joinType": join_type},
                    "children": join_children,
                })
        else:
            tok = self.peek()
            self.errors.append({
                "message": "Missing 'FROM' clause in query",
                "line": tok["line"] if tok else 1,
                "column": tok["column"] if tok else 1,
                "expectedToken": "FROM",
                "foundToken": tok["value"] if tok else "EOF",
                "suggestion": "Add 'FROM <table_name>' after column list",
            })

        where_node: Optional[Dict[str, Any]] = None
        if self.match("WHERE"):
            self.grammar_rules_applied.add("WhereClause -> WHERE BooleanExpression")
            cond = self.parse_expression()
            where_node = {
                "id": self.next_id("where"),
                "type": "WhereClause",
                "label": "WHERE Clause",
                "grammarRule": "WhereClause -> WHERE BooleanExpression",
                "children": [cond],
            }

        group_by_node: Optional[Dict[str, Any]] = None
        if self.match("GROUP"):
            self.consume("BY", "Expected 'BY' after 'GROUP'")
            self.grammar_rules_applied.add("GroupByClause -> GROUP BY ColumnList")
            group_cols = self.parse_expression_list()
            group_by_node = {
                "id": self.next_id("group_by"),
                "type": "GroupByClause",
                "label": "GROUP BY Clause",
                "grammarRule": "GroupByClause -> GROUP BY ColumnList",
                "children": group_cols,
            }

        having_node: Optional[Dict[str, Any]] = None
        if self.match("HAVING"):
            self.grammar_rules_applied.add("HavingClause -> HAVING BooleanExpression")
            having_expr = self.parse_expression()
            having_node = {
                "id": self.next_id("having"),
                "type": "HavingClause",
                "label": "HAVING Clause",
                "grammarRule": "HavingClause -> HAVING BooleanExpression",
                "children": [having_expr],
            }

        order_by_node: Optional[Dict[str, Any]] = None
        if self.match("ORDER"):
            self.consume("BY", "Expected 'BY' after 'ORDER'")
            self.grammar_rules_applied.add("OrderByClause -> ORDER BY OrderItemList")
            order_items = self.parse_order_by_items()
            order_by_node = {
                "id": self.next_id("order_by"),
                "type": "OrderByClause",
                "label": "ORDER BY Clause",
                "grammarRule": "OrderByClause -> ORDER BY OrderItemList",
                "children": order_items,
            }

        limit_node: Optional[Dict[str, Any]] = None
        if self.match("LIMIT"):
            self.grammar_rules_applied.add("LimitClause -> LIMIT IntegerLiteral")
            tok = self.peek()
            val_str = tok["value"] if tok else "10"
            self.advance()
            limit_val = int(val_str) if val_str.isdigit() else 10
            limit_node = {
                "id": self.next_id("limit"),
                "type": "LimitClause",
                "label": f"LIMIT {limit_val}",
                "value": str(limit_val),
                "grammarRule": "LimitClause -> LIMIT IntegerLiteral",
                "attributes": {"limit": limit_val},
            }

        children: List[Dict[str, Any]] = [projection_list_node]
        if from_node:
            children.append(from_node)
        children.extend(joins)
        if where_node:
            children.append(where_node)
        if group_by_node:
            children.append(group_by_node)
        if having_node:
            children.append(having_node)
        if order_by_node:
            children.append(order_by_node)
        if limit_node:
            children.append(limit_node)

        return {
            "id": self.next_id("select_stmt"),
            "type": "SelectStatement",
            "label": f"SelectStatement{' [DISTINCT]' if is_distinct else ''}",
            "grammarRule": "QueryStatement -> SELECT Projection FROM Source [Clauses]",
            "attributes": {"isDistinct": is_distinct},
            "children": children,
        }

    def parse_projection_list(self) -> Dict[str, Any]:
        self.grammar_rules_applied.add("ProjectionList -> ProjectionItem (, ProjectionItem)*")
        items: List[Dict[str, Any]] = []

        while True:
            if self.check("*"):
                self.advance()
                items.append({
                    "id": self.next_id("proj_star"),
                    "type": "ProjectionItem",
                    "label": "ProjectionItem: *",
                    "value": "*",
                    "grammarRule": "ProjectionItem -> *",
                })
            else:
                expr = self.parse_expression()
                alias: Optional[str] = None
                if self.match("AS"):
                    alias = self.advance()["value"]
                elif self.peek() and self.peek()["type"] == "IDENTIFIER" and self.peek()["value"].upper() not in {
                    "FROM", "WHERE", "JOIN", "GROUP", "ORDER", "LIMIT", "HAVING"
                }:
                    alias = self.advance()["value"]

                items.append({
                    "id": self.next_id("proj_item"),
                    "type": "ProjectionItem",
                    "label": f"ProjectionItem ({alias})" if alias else "ProjectionItem",
                    "value": alias,
                    "grammarRule": "ProjectionItem -> Expression [AS Alias]",
                    "attributes": {"alias": alias} if alias else {},
                    "children": [expr],
                })

            if not self.match(","):
                break

        return {
            "id": self.next_id("proj_list"),
            "type": "ProjectionList",
            "label": f"ProjectionList ({len(items)} items)",
            "grammarRule": "ProjectionList -> ProjectionItem (, ProjectionItem)*",
            "children": items,
        }

    def parse_table_reference(self) -> Dict[str, Any]:
        self.grammar_rules_applied.add("TableReference -> TableName [AS Alias]")
        table_tok = self.advance() if not self.is_at_end() else None
        table_name = table_tok["value"] if table_tok else "unknown_table"
        alias: Optional[str] = None

        if self.match("AS"):
            alias = self.advance()["value"]
        elif self.peek() and self.peek()["type"] == "IDENTIFIER" and self.peek()["value"].upper() not in {
            "JOIN", "INNER", "LEFT", "RIGHT", "WHERE", "GROUP", "ORDER", "ON", "LIMIT"
        }:
            alias = self.advance()["value"]

        return {
            "id": self.next_id("table_ref"),
            "type": "TableReference",
            "label": f"Table: {table_name} AS {alias}" if alias else f"Table: {table_name}",
            "value": table_name,
            "grammarRule": "TableReference -> TableName [AS Alias]",
            "attributes": {"tableName": table_name, "alias": alias or table_name},
            "line": table_tok["line"] if table_tok else 1,
            "column": table_tok["column"] if table_tok else 1,
        }

    def parse_expression(self) -> Dict[str, Any]:
        return self.parse_logical_or()

    def parse_logical_or(self) -> Dict[str, Any]:
        expr = self.parse_logical_and()
        while self.match("OR"):
            self.grammar_rules_applied.add("BooleanExpression -> Term OR Term")
            right = self.parse_logical_and()
            expr = {
                "id": self.next_id("bin_or"),
                "type": "BinaryExpression",
                "label": "BinaryExpr: OR",
                "value": "OR",
                "grammarRule": "BooleanExpr -> BooleanExpr OR BooleanExpr",
                "attributes": {"operator": "OR"},
                "children": [expr, right],
            }
        return expr

    def parse_logical_and(self) -> Dict[str, Any]:
        expr = self.parse_comparison()
        while self.match("AND"):
            self.grammar_rules_applied.add("BooleanExpression -> Factor AND Factor")
            right = self.parse_comparison()
            expr = {
                "id": self.next_id("bin_and"),
                "type": "BinaryExpression",
                "label": "BinaryExpr: AND",
                "value": "AND",
                "grammarRule": "BooleanExpr -> BooleanExpr AND BooleanExpr",
                "attributes": {"operator": "AND"},
                "children": [expr, right],
            }
        return expr

    def parse_comparison(self) -> Dict[str, Any]:
        expr = self.parse_additive()
        comp_ops = [">=", "<=", "!=", "<>", "=", ">", "<", "LIKE", "IN"]

        for op in comp_ops:
            if self.check(op):
                self.advance()
                self.grammar_rules_applied.add(f"ComparisonExpression -> Expr {op} Expr")
                right = self.parse_additive()
                return {
                    "id": self.next_id("comp_op"),
                    "type": "BinaryExpression",
                    "label": f"Comparison: {op}",
                    "value": op,
                    "grammarRule": f"ComparisonExpr -> Expr {op} Expr",
                    "attributes": {"operator": op},
                    "children": [expr, right],
                }
        return expr

    def parse_additive(self) -> Dict[str, Any]:
        expr = self.parse_multiplicative()
        while self.check("+") or self.check("-"):
            op = self.advance()["value"]
            right = self.parse_multiplicative()
            expr = {
                "id": self.next_id("math_add"),
                "type": "BinaryExpression",
                "label": f"Arithmetic: {op}",
                "value": op,
                "grammarRule": f"ArithmeticExpr -> Expr {op} Expr",
                "attributes": {"operator": op},
                "children": [expr, right],
            }
        return expr

    def parse_multiplicative(self) -> Dict[str, Any]:
        expr = self.parse_primary()
        while self.check("*") or self.check("/"):
            op = self.advance()["value"]
            right = self.parse_primary()
            expr = {
                "id": self.next_id("math_mul"),
                "type": "BinaryExpression",
                "label": f"Arithmetic: {op}",
                "value": op,
                "grammarRule": f"ArithmeticExpr -> Expr {op} Expr",
                "attributes": {"operator": op},
                "children": [expr, right],
            }
        return expr

    def parse_primary(self) -> Dict[str, Any]:
        token = self.peek()
        if not token:
            return {
                "id": self.next_id("eof"),
                "type": "Literal",
                "label": "NULL",
                "grammarRule": "Primary -> NULL",
            }

        if self.match("("):
            if self.check("SELECT"):
                subquery = self.parse_select_statement()
                self.consume(")", "Expected ')' after subquery")
                return {
                    "id": self.next_id("subquery"),
                    "type": "Subquery",
                    "label": "Scalar Subquery",
                    "grammarRule": "Primary -> ( SELECT ... )",
                    "children": [subquery],
                }
            expr = self.parse_expression()
            self.consume(")", "Expected ')' after expression")
            return expr

        agg_names = {"COUNT", "SUM", "AVG", "MIN", "MAX"}
        if token["value"].upper() in agg_names:
            func_name = self.advance()["value"].upper()
            self.consume("(", f"Expected '(' after function {func_name}")
            if self.check("*"):
                self.advance()
                arg_expr = {
                    "id": self.next_id("star_arg"),
                    "type": "Literal",
                    "label": "*",
                    "value": "*",
                    "grammarRule": "FunctionArg -> *",
                }
            else:
                arg_expr = self.parse_expression()
            self.consume(")", f"Expected ')' after arguments of {func_name}")
            return {
                "id": self.next_id("func_agg"),
                "type": "FunctionCall",
                "label": f"Aggregate: {func_name}()",
                "value": func_name,
                "grammarRule": "FunctionCall -> FuncName ( Argument )",
                "attributes": {"function": func_name},
                "children": [arg_expr],
            }

        if token["type"] == "LITERAL_NUMBER":
            tok = self.advance()
            val_num = float(tok["value"]) if "." in tok["value"] else int(tok["value"])
            return {
                "id": self.next_id("lit_num"),
                "type": "Literal",
                "label": f"Number: {tok['value']}",
                "value": tok["value"],
                "grammarRule": "Literal -> NumberLiteral",
                "attributes": {"rawType": "INT_OR_FLOAT", "value": val_num},
                "line": tok["line"],
                "column": tok["column"],
            }

        if token["type"] == "LITERAL_STRING":
            tok = self.advance()
            clean_val = tok["value"].strip("'\"")
            return {
                "id": self.next_id("lit_str"),
                "type": "Literal",
                "label": f"String: '{clean_val}'",
                "value": clean_val,
                "grammarRule": "Literal -> StringLiteral",
                "attributes": {"rawType": "VARCHAR", "value": clean_val},
                "line": tok["line"],
                "column": tok["column"],
            }

        if token["type"] in ("IDENTIFIER", "KEYWORD"):
            tok = self.advance()
            full_ident = tok["value"]
            if self.match("."):
                col_tok = self.peek()
                if col_tok and (col_tok["type"] == "IDENTIFIER" or col_tok["value"] == "*"):
                    self.advance()
                    full_ident = f"{tok['value']}.{col_tok['value']}"
            return {
                "id": self.next_id("col_ref"),
                "type": "Identifier",
                "label": f"Column: {full_ident}",
                "value": full_ident,
                "grammarRule": "Identifier -> [TableQualifier.]ColumnName",
                "attributes": {"identifier": full_ident},
                "line": tok["line"],
                "column": tok["column"],
            }

        tok = self.advance()
        return {
            "id": self.next_id("unknown"),
            "type": "Literal",
            "label": f"Token: {tok['value']}",
            "value": tok["value"],
            "grammarRule": "Token -> Unknown",
        }

    def parse_expression_list(self) -> List[Dict[str, Any]]:
        items: List[Dict[str, Any]] = []
        while True:
            items.append(self.parse_expression())
            if not self.match(","):
                break
        return items

    def parse_order_by_items(self) -> List[Dict[str, Any]]:
        items: List[Dict[str, Any]] = []
        while True:
            expr = self.parse_expression()
            direction = "ASC"
            if self.match("DESC"):
                direction = "DESC"
            elif self.match("ASC"):
                direction = "ASC"
            items.append({
                "id": self.next_id("order_item"),
                "type": "OrderByItem",
                "label": f"Order: {direction}",
                "value": direction,
                "grammarRule": "OrderItem -> Expression [ASC | DESC]",
                "attributes": {"direction": direction},
                "children": [expr],
            })
            if not self.match(","):
                break
        return items

    def calculate_depth(self, node: Dict[str, Any]) -> int:
        children = node.get("children", [])
        if not children:
            return 1
        return 1 + max(self.calculate_depth(c) for c in children)

    def count_nodes(self, node: Dict[str, Any]) -> int:
        children = node.get("children", [])
        if not children:
            return 1
        return 1 + sum(self.count_nodes(c) for c in children)


def parse_sql(tokens: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Parse tokens into AST result."""
    parser = SQLParser(tokens)
    return parser.parse()
