# Mini SQL Query Compiler with Query Optimization - Python Backend

A modular Python Flask backend and educational compiler engine built for the **Mini SQL Query Compiler with Query Optimization** project.

---

## 1. Architecture Overview

The backend implements the 6 canonical stages of a database query compiler:

```
SQL Query
   │
   ▼
[ Phase 1: Lexical Analyzer (lexer.py) ]
   │ Token Stream & DFA Regex Rule Matches
   ▼
[ Phase 2: Syntax Analyzer & Parser (parser.py) ]
   │ Abstract Syntax Tree (AST) & CFG Productions
   ▼
[ Phase 3: Semantic Analyzer (analyzer.py) ]
   │ Schema Catalog Binding, Symbol Table & Scope Resolution
   ▼
[ Phase 4: Intermediate Representation (intermediate.py) ]
   │ Canonical Relational Algebra (RA) & Linear Three-Address Code (TAC)
   ▼
[ Phase 5: Query Optimizer (optimizer.py) ]
   │ Predicate Pushdown, Projection Pushdown, Constant Folding, Join Reordering
   ▼
[ Phase 6: Physical Execution Plan (execution_plan.py) ]
   │ Volcano Pipeline Iterators (IndexScan, HashJoin) & PostgreSQL EXPLAIN
```

---

## 2. Quick Start Guide

### Prerequisites
- Python 3.9+ installed
- Windows PowerShell, macOS Terminal, or Linux Bash

### Step 1: Create and Activate Virtual Environment
```powershell
# Windows PowerShell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

```bash
# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### Step 2: Install Dependencies
```powershell
pip install -r requirements.txt
```

### Step 3: Run Unit & Integration Tests
```powershell
pytest -v
```

### Step 4: Start the Flask Development Server
```powershell
python app.py
```
The server will bind to `http://0.0.0.0:5000` with Cross-Origin Resource Sharing (CORS) enabled.

---

## 3. API Endpoints

### 1. `GET /health`
Returns service availability status, version, and engine description.
```json
{
  "status": "healthy",
  "application": "Mini SQL Query Compiler with Query Optimization",
  "version": "1.0.0",
  "engine": "Python 3.x SQL Compiler Engine"
}
```

### 2. `POST /api/compile`
Compiles an SQL statement across all 6 phases.
- **Request Body:**
  ```json
  {
    "query": "SELECT s.name, s.gpa FROM students s WHERE s.gpa >= 3.8;",
    "catalog": { ...optional custom schema catalog }
  }
  ```
- **Response Body (`CompilerResult`):**
  Matches the exact TypeScript frontend interface including `lexer`, `syntax`, `semantic`, `intermediate`, `optimization`, and `executionPlan`.

---

## 4. Connecting to the React Frontend

1. Ensure the Flask server is running on `http://localhost:5000`.
2. In the React frontend, click **Flask Backend** in the top navigation bar.
3. Click **Test Ping** to confirm connectivity with `GET /health`.
4. Switch the Engine Mode toggle from **Simulated Engine** to **Live Flask Backend**.
5. All queries executed in the SQL Editor (`Ctrl+Enter`) will now compile directly against your Python backend!
