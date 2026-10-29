import pytest
from compiler.lexer import tokenize
from compiler.parser import parse_sql


def test_parse_simple_select():
    sql = "SELECT id, name FROM students;"
    tokens = tokenize(sql)["tokens"]
    syntax = parse_sql(tokens)

    assert len(syntax["errors"]) == 0
    ast = syntax["ast"]
    assert ast["type"] == "SelectStatement"
    assert syntax["depth"] >= 3
    assert syntax["nodeCount"] >= 5

    # Check children: ProjectionList and TableReference
    child_types = [c["type"] for c in ast["children"]]
    assert "ProjectionList" in child_types
    assert "TableReference" in child_types


def test_parse_join_and_where():
    sql = """
    SELECT s.name, d.name AS dept_name
    FROM students s
    INNER JOIN departments d ON s.dept_id = d.id
    WHERE s.gpa >= 3.8;
    """
    tokens = tokenize(sql)["tokens"]
    syntax = parse_sql(tokens)

    assert len(syntax["errors"]) == 0
    ast = syntax["ast"]
    child_types = [c["type"] for c in ast["children"]]
    assert "JoinClause" in child_types
    assert "WhereClause" in child_types

    join_node = next(c for c in ast["children"] if c["type"] == "JoinClause")
    assert join_node["attributes"]["joinType"] == "INNER"


def test_parse_aggregates_group_by_having_order_limit():
    sql = """
    SELECT d.name, COUNT(s.id), AVG(s.gpa)
    FROM departments d
    JOIN students s ON d.id = s.dept_id
    GROUP BY d.name
    HAVING COUNT(s.id) > 10
    ORDER BY d.name ASC
    LIMIT 25;
    """
    tokens = tokenize(sql)["tokens"]
    syntax = parse_sql(tokens)

    assert len(syntax["errors"]) == 0
    ast = syntax["ast"]
    child_types = [c["type"] for c in ast["children"]]
    assert "GroupByClause" in child_types
    assert "HavingClause" in child_types
    assert "OrderByClause" in child_types
    assert "LimitClause" in child_types


def test_parse_syntax_error_missing_select():
    sql = "FROM students WHERE gpa > 3.0;"
    tokens = tokenize(sql)["tokens"]
    syntax = parse_sql(tokens)

    assert len(syntax["errors"]) > 0
    err = syntax["errors"][0]
    assert "Expected 'SELECT'" in err["message"]
    assert err["expectedToken"] == "SELECT"


def test_parse_syntax_error_missing_from():
    sql = "SELECT id, name;"
    tokens = tokenize(sql)["tokens"]
    syntax = parse_sql(tokens)

    assert len(syntax["errors"]) > 0
    assert any("FROM" in err["message"] for err in syntax["errors"])
