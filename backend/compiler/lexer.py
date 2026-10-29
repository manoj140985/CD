"""
Lexical Analyzer (Scanner / Tokenizer) for Mini SQL Query Compiler.
Produces token stream with regex patterns, categories, and source coordinates.
"""

import time
import re
from typing import List, Dict, Any, Tuple

KEYWORDS = {
    "SELECT", "FROM", "WHERE", "JOIN", "INNER", "LEFT", "RIGHT", "FULL",
    "ON", "AS", "AND", "OR", "NOT", "GROUP", "BY", "HAVING", "ORDER",
    "ASC", "DESC", "LIMIT", "OFFSET", "COUNT", "SUM", "AVG", "MIN", "MAX",
    "IN", "LIKE", "BETWEEN", "IS", "NULL", "TRUE", "FALSE", "DISTINCT",
    "UNION", "ALL", "CASE", "WHEN", "THEN", "ELSE", "END"
}

CLAUSE_KEYWORDS = {"SELECT", "FROM", "WHERE", "JOIN", "GROUP", "ORDER", "HAVING", "LIMIT"}
LOGICAL_KEYWORDS = {"AND", "OR", "NOT"}

TOKEN_RULES: List[Tuple[str, str, str, str]] = [
    # (type, regex_pattern, category, pattern_display)
    ("COMMENT", r"^(--[^\n]*|/\*[\s\S]*?\*/)", "Other", r"^(--[^\n]*|/\*[\s\S]*?\*/)"),
    ("LITERAL_STRING", r"^'([^'\\]|\\.)*'", "Literal", r"^'([^'\\]|\\.)*'"),
    ("LITERAL_STRING", r'^"([^"\\]|\\.)*"', "Literal", r'^"([^"\\]|\\.)*"'),
    ("LITERAL_NUMBER", r"^\d+(\.\d+)?([eE][+-]?\d+)?", "Literal", r"^\d+(\.\d+)?"),
    ("OPERATOR", r"^(>=|<=|!=|<>|=|>|<)", "Comparison", r"^(>=|<=|!=|<>|=|>|<)"),
    ("OPERATOR", r"^(\+|-|\*|/|%)", "Other", r"^(\+|-|\*|/|%)"),
    ("PUNCTUATION", r"^(\(|\)|,|[.]|;)", "Delimiter", r"^(\(|\)|,|[.]|;)"),
    ("IDENTIFIER", r"^[a-zA-Z_][a-zA-Z0-9_]*", "Identifier", r"^[a-zA-Z_][a-zA-Z0-9_]*"),
]

COMPILED_RULES = [(ttype, re.compile(pat), cat, pat_str) for ttype, pat, cat, pat_str in TOKEN_RULES]


def tokenize(sql: str) -> Dict[str, Any]:
    """
    Tokenize an SQL string into structured tokens matching the frontend LexerResult.
    """
    start_time = time.perf_counter()
    tokens: List[Dict[str, Any]] = []
    errors: List[str] = []

    line = 1
    column = 1
    cursor = 0
    token_id = 1
    sql_len = len(sql)

    while cursor < sql_len:
        char = sql[cursor]

        # Handle newlines
        if char == "\n":
            line += 1
            column = 1
            cursor += 1
            continue

        # Skip whitespace
        if char.isspace():
            column += 1
            cursor += 1
            continue

        remaining = sql[cursor:]
        matched = False

        for ttype, pattern, category, pat_str in COMPILED_RULES:
            match = pattern.match(remaining)
            if match and match.start() == 0:
                raw_val = match.group(0)
                final_type = ttype
                final_cat = category

                if final_type == "IDENTIFIER":
                    upper_val = raw_val.upper()
                    if upper_val in KEYWORDS:
                        final_type = "KEYWORD"
                        if upper_val in CLAUSE_KEYWORDS:
                            final_cat = "Clause"
                        elif upper_val in LOGICAL_KEYWORDS:
                            final_cat = "Logical"
                        else:
                            final_cat = "DML"

                tokens.append({
                    "id": token_id,
                    "type": final_type,
                    "value": raw_val,
                    "line": line,
                    "column": column,
                    "regexRule": pat_str,
                    "category": final_cat,
                })
                token_id += 1

                length = len(raw_val)
                # If multiline comment, update line & column
                if "\n" in raw_val:
                    num_lines = raw_val.count("\n")
                    line += num_lines
                    last_nl = raw_val.rfind("\n")
                    column = len(raw_val) - last_nl
                else:
                    column += length

                cursor += length
                matched = True
                break

        if not matched:
            errors.append(f"Unrecognized character '{char}' at line {line}, column {column}")
            tokens.append({
                "id": token_id,
                "type": "UNKNOWN",
                "value": char,
                "line": line,
                "column": column,
                "regexRule": "None (Unrecognized)",
                "category": "Other",
            })
            token_id += 1
            cursor += 1
            column += 1

    duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

    stats = {
        "keywords": sum(1 for t in tokens if t["type"] == "KEYWORD"),
        "identifiers": sum(1 for t in tokens if t["type"] == "IDENTIFIER"),
        "literals": sum(1 for t in tokens if t["type"] in ("LITERAL_NUMBER", "LITERAL_STRING")),
        "operators": sum(1 for t in tokens if t["type"] == "OPERATOR"),
        "punctuations": sum(1 for t in tokens if t["type"] == "PUNCTUATION"),
    }

    return {
        "tokens": tokens,
        "tokenCount": len(tokens),
        "stats": stats,
        "durationMs": duration_ms,
        "errors": errors,
    }
