import pytest
from compiler.lexer import tokenize
from compiler.parser import parse_sql
from compiler.intermediate import generate_intermediate
from compiler.optimizer import optimize_query
from compiler.catalog import UNIVERSITY_CATALOG


def test_constant_folding_and_tautology():
    sql = "SELECT id FROM students WHERE 1 = 1 AND admission_year >= (2024 - 4);"
    tokens = tokenize(sql)["tokens"]
    ast = parse_sql(tokens)["ast"]
    ir = generate_intermediate(ast, UNIVERSITY_CATALOG)
    opt = optimize_query(ir["algebraTree"], UNIVERSITY_CATALOG)

    rule_ids = [r["ruleId"] for r in opt["rulesApplied"]]
    assert "RULE_TAUTOLOGY_ELIMINATION" in rule_ids
    assert "RULE_CONSTANT_FOLDING" in rule_ids

    # Check that (2024 - 4) was folded to 2020
    const_rule = next(r for r in opt["rulesApplied"] if r["ruleId"] == "RULE_CONSTANT_FOLDING")
    assert const_rule["afterSnippet"] == "2020"


def test_predicate_pushdown():
    sql = """
    SELECT s.name, d.name
    FROM students s
    JOIN departments d ON s.dept_id = d.id
    WHERE s.gpa >= 3.8 AND d.budget > 500000;
    """
    tokens = tokenize(sql)["tokens"]
    ast = parse_sql(tokens)["ast"]
    ir = generate_intermediate(ast, UNIVERSITY_CATALOG)
    opt = optimize_query(ir["algebraTree"], UNIVERSITY_CATALOG)

    rule_ids = [r["ruleId"] for r in opt["rulesApplied"]]
    assert "RULE_PREDICATE_PUSHDOWN_LEFT" in rule_ids
    assert "RULE_PREDICATE_PUSHDOWN_RIGHT" in rule_ids

    # Optimization metrics must show measurable cost & tuple reductions
    metrics = opt["metrics"]
    assert metrics["costReductionPercent"] > 0
    assert metrics["tuplesReductionPercent"] > 0
    assert metrics["optimizedEstimatedCost"] < metrics["originalEstimatedCost"]
    assert metrics["optimizedIntermediateTuples"] < metrics["originalIntermediateTuples"]


def test_projection_pushdown_recorded():
    sql = "SELECT s.name FROM students s JOIN departments d ON s.dept_id = d.id;"
    tokens = tokenize(sql)["tokens"]
    ast = parse_sql(tokens)["ast"]
    ir = generate_intermediate(ast, UNIVERSITY_CATALOG)
    opt = optimize_query(ir["algebraTree"], UNIVERSITY_CATALOG)

    rule_ids = [r["ruleId"] for r in opt["rulesApplied"]]
    assert "RULE_PROJECTION_PUSHDOWN" in rule_ids
