import pytest
from compiler.lexer import tokenize
from compiler.parser import parse_sql
from compiler.analyzer import analyze_semantics
from compiler.catalog import UNIVERSITY_CATALOG


def test_semantic_valid_query():
    sql = "SELECT s.id, s.name, s.gpa FROM students s WHERE s.gpa >= 3.5;"
    tokens = tokenize(sql)["tokens"]
    ast = parse_sql(tokens)["ast"]
    result = analyze_semantics(ast, UNIVERSITY_CATALOG)

    assert result["isValid"] is True
    assert "students" in result["resolvedTables"]
    assert "students.name" in result["resolvedColumns"]
    assert len(result["symbolTable"]) > 0

    table_sym = next(s for s in result["symbolTable"] if s["name"] == "students")
    assert table_sym["category"] == "TABLE"


def test_semantic_unknown_table():
    sql = "SELECT id, name FROM non_existent_table;"
    tokens = tokenize(sql)["tokens"]
    ast = parse_sql(tokens)["ast"]
    result = analyze_semantics(ast, UNIVERSITY_CATALOG)

    assert result["isValid"] is False
    codes = [d["code"] for d in result["diagnostics"]]
    assert "ERR_TABLE_NOT_FOUND" in codes


def test_semantic_unknown_column():
    sql = "SELECT s.id, s.non_existent_column FROM students s;"
    tokens = tokenize(sql)["tokens"]
    ast = parse_sql(tokens)["ast"]
    result = analyze_semantics(ast, UNIVERSITY_CATALOG)

    assert result["isValid"] is False
    codes = [d["code"] for d in result["diagnostics"]]
    assert "ERR_COLUMN_NOT_FOUND" in codes


def test_semantic_ambiguous_column():
    # Both students and departments have an 'id' and 'name' column
    sql = "SELECT id FROM students s JOIN departments d ON s.dept_id = d.id;"
    tokens = tokenize(sql)["tokens"]
    ast = parse_sql(tokens)["ast"]
    result = analyze_semantics(ast, UNIVERSITY_CATALOG)

    assert result["isValid"] is False
    codes = [d["code"] for d in result["diagnostics"]]
    assert "ERR_AMBIGUOUS_COLUMN" in codes


def test_semantic_type_mismatch_warning():
    sql = "SELECT id FROM students WHERE age > 'twenty';"
    tokens = tokenize(sql)["tokens"]
    ast = parse_sql(tokens)["ast"]
    result = analyze_semantics(ast, UNIVERSITY_CATALOG)

    codes = [d["code"] for d in result["diagnostics"]]
    assert "WARN_TYPE_MISMATCH" in codes


def test_semantic_aggregate_without_group_by():
    sql = "SELECT dept_id, AVG(gpa) FROM students;"
    tokens = tokenize(sql)["tokens"]
    ast = parse_sql(tokens)["ast"]
    result = analyze_semantics(ast, UNIVERSITY_CATALOG)

    assert result["isValid"] is False
    codes = [d["code"] for d in result["diagnostics"]]
    assert "ERR_AGGREGATE_WITHOUT_GROUP_BY" in codes
