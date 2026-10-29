import pytest
from app import app


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "healthy"
    assert "application" in data
    assert "version" in data


def test_compile_valid_query(client):
    payload = {
        "query": "SELECT s.name, s.gpa FROM students s WHERE s.gpa >= 3.8;"
    }
    response = client.post("/api/compile", json=payload)
    assert response.status_code == 200
    data = response.get_json()

    # Verify exact contract matching frontend TypeScript CompilerResult
    assert data["source"] == "remote_flask"
    assert "query" in data
    assert "timestamp" in data
    assert "totalDurationMs" in data
    assert "hasErrors" in data
    assert data["hasErrors"] is False

    # Check all 6 compiler phases exist
    assert "lexer" in data
    assert "syntax" in data
    assert "semantic" in data
    assert "intermediate" in data
    assert "optimization" in data
    assert "executionPlan" in data

    # Verify specific phase contents
    assert data["lexer"]["tokenCount"] > 0
    assert data["syntax"]["depth"] > 0
    assert data["semantic"]["isValid"] is True
    assert len(data["intermediate"]["tacInstructions"]) > 0
    assert data["optimization"]["metrics"]["costReductionPercent"] >= 0
    assert "explainText" in data["executionPlan"]


def test_compile_empty_query(client):
    payload = {"query": "   "}
    response = client.post("/api/compile", json=payload)
    assert response.status_code == 200
    data = response.get_json()
    assert data["hasErrors"] is True
    assert len(data["syntax"]["errors"]) > 0


def test_compile_malformed_json(client):
    response = client.post(
        "/api/compile",
        data="not-valid-json",
        content_type="application/json"
    )
    assert response.status_code == 400
    data = response.get_json()
    assert "error" in data


def test_compile_query_with_semantic_error(client):
    payload = {
        "query": "SELECT s.id, s.fake_column FROM students s;"
    }
    response = client.post("/api/compile", json=payload)
    assert response.status_code == 200
    data = response.get_json()
    assert data["hasErrors"] is True
    assert data["semantic"]["isValid"] is False
    codes = [d["code"] for d in data["semantic"]["diagnostics"]]
    assert "ERR_COLUMN_NOT_FOUND" in codes
