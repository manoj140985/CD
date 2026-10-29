import pytest
from compiler.lexer import tokenize


def test_tokenize_basic_select():
    sql = "SELECT id, name FROM students WHERE gpa >= 3.5;"
    result = tokenize(sql)

    assert result["tokenCount"] > 0
    assert result["stats"]["keywords"] >= 3  # SELECT, FROM, WHERE
    assert result["stats"]["identifiers"] >= 3  # id, name, students, gpa
    assert result["stats"]["operators"] >= 1  # >=
    assert len(result["errors"]) == 0

    types = [t["type"] for t in result["tokens"]]
    assert "KEYWORD" in types
    assert "IDENTIFIER" in types
    assert "OPERATOR" in types
    assert "PUNCTUATION" in types


def test_tokenize_literals_and_categories():
    sql = "SELECT 'Computer Science', 42, 3.1415 FROM departments;"
    result = tokenize(sql)

    tokens = result["tokens"]
    str_tok = next(t for t in tokens if t["type"] == "LITERAL_STRING")
    num_tok = next(t for t in tokens if t["type"] == "LITERAL_NUMBER" and t["value"] == "42")
    float_tok = next(t for t in tokens if t["type"] == "LITERAL_NUMBER" and t["value"] == "3.1415")

    assert str_tok["value"] == "'Computer Science'"
    assert str_tok["category"] == "Literal"
    assert num_tok["category"] == "Literal"
    assert float_tok["category"] == "Literal"


def test_tokenize_comments():
    sql = "-- Single line comment\nSELECT id /* block comment */ FROM students;"
    result = tokenize(sql)

    comments = [t for t in result["tokens"] if t["type"] == "COMMENT"]
    assert len(comments) == 2
    assert "-- Single line comment" in comments[0]["value"]
    assert "/* block comment */" in comments[1]["value"]


def test_tokenize_unrecognized_character():
    sql = "SELECT @#$ FROM students;"
    result = tokenize(sql)

    assert len(result["errors"]) >= 1
    unknowns = [t for t in result["tokens"] if t["type"] == "UNKNOWN"]
    assert len(unknowns) >= 1
    assert any("Unrecognized character" in err for err in result["errors"])


def test_line_and_column_tracking():
    sql = "SELECT\n  name\nFROM students;"
    result = tokenize(sql)

    name_tok = next(t for t in result["tokens"] if t["value"] == "name")
    assert name_tok["line"] == 2
    assert name_tok["column"] == 3
