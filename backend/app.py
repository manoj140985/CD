"""
Flask API Server for Mini SQL Query Compiler with Query Optimization.
Provides health check and compilation endpoints for the React frontend.
"""

import sys
import traceback
from flask import Flask, request, jsonify
from flask_cors import CORS

from compiler.compiler_engine import compile_sql

app = Flask(__name__)
# Enable CORS for all routes so React frontend on port 3000 can communicate with port 5000
CORS(app, resources={r"/*": {"origins": "*"}})


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint expected by the frontend BackendModal ping test."""
    return jsonify({
        "status": "healthy",
        "application": "Mini SQL Query Compiler with Query Optimization",
        "version": "1.0.0",
        "engine": "Python 3.x SQL Compiler Engine",
    }), 200


@app.route("/api/compile", methods=["POST"])
def compile_query():
    """
    Compilation endpoint expected by the frontend.
    Accepts JSON payload: { "query": "<SQL string>", "catalog": { ...optional } }
    Returns full CompilerResult matching TypeScript interfaces.
    """
    if not request.is_json:
        return jsonify({
            "error": "Bad Request: Content-Type must be application/json",
            "hasErrors": True,
        }), 400

    try:
        data = request.get_json(force=True)
    except Exception as e:
        return jsonify({
            "error": f"Malformed JSON: {str(e)}",
            "hasErrors": True,
        }), 400

    query = data.get("query", "")
    custom_catalog = data.get("catalog")

    if not isinstance(query, str) or not query.strip():
        # Handle empty query gracefully with structured compiler response
        result = compile_sql("", custom_catalog)
        result["hasErrors"] = True
        result["syntax"]["errors"].append({
            "message": "Empty query received. Please enter a valid SQL SELECT statement.",
            "line": 1,
            "column": 1,
            "expectedToken": "SELECT",
            "foundToken": "EOF",
            "suggestion": "Example: SELECT id, name FROM students WHERE gpa > 3.5;",
        })
        return jsonify(result), 200

    try:
        result = compile_sql(query, custom_catalog)
        return jsonify(result), 200
    except Exception as exc:
        traceback.print_exc(file=sys.stderr)
        return jsonify({
            "error": f"Internal compiler error: {str(exc)}",
            "query": query,
            "hasErrors": True,
            "traceback": traceback.format_exc(),
        }), 500


if __name__ == "__main__":
    print("=" * 60)
    print("Mini SQL Query Compiler Flask Server")
    print("Port: 5000 | Host: 0.0.0.0")
    print("Health Endpoint: GET  http://localhost:5000/health")
    print("Compile Endpoint: POST http://localhost:5000/api/compile")
    print("=" * 60)
    app.run(host="0.0.0.0", port=5000, debug=True)
