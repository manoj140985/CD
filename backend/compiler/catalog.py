"""
Relational Catalog definitions for Mini SQL Query Compiler.
Faithfully mirrors frontend src/services/catalog.ts.
"""

from typing import Dict, Any, Optional

UNIVERSITY_CATALOG: Dict[str, Dict[str, Any]] = {
    "students": {
        "name": "students",
        "rowCount": 10000,
        "primaryKey": "id",
        "columns": [
            {"name": "id", "type": "INT", "nullable": False, "isPrimary": True, "indexed": True},
            {"name": "name", "type": "VARCHAR", "nullable": False},
            {"name": "email", "type": "VARCHAR", "nullable": False, "indexed": True},
            {"name": "age", "type": "INT", "nullable": True},
            {"name": "gpa", "type": "FLOAT", "nullable": True, "indexed": True},
            {
                "name": "dept_id",
                "type": "INT",
                "nullable": False,
                "isForeign": True,
                "references": {"table": "departments", "column": "id"},
            },
            {"name": "admission_year", "type": "INT", "nullable": False},
        ],
    },
    "departments": {
        "name": "departments",
        "rowCount": 20,
        "primaryKey": "id",
        "columns": [
            {"name": "id", "type": "INT", "nullable": False, "isPrimary": True, "indexed": True},
            {"name": "name", "type": "VARCHAR", "nullable": False},
            {"name": "code", "type": "VARCHAR", "nullable": False, "indexed": True},
            {"name": "budget", "type": "FLOAT", "nullable": True},
            {"name": "building", "type": "VARCHAR", "nullable": True},
        ],
    },
    "courses": {
        "name": "courses",
        "rowCount": 500,
        "primaryKey": "id",
        "columns": [
            {"name": "id", "type": "INT", "nullable": False, "isPrimary": True, "indexed": True},
            {"name": "title", "type": "VARCHAR", "nullable": False},
            {"name": "code", "type": "VARCHAR", "nullable": False, "indexed": True},
            {"name": "credits", "type": "INT", "nullable": False},
            {
                "name": "dept_id",
                "type": "INT",
                "nullable": False,
                "isForeign": True,
                "references": {"table": "departments", "column": "id"},
            },
            {
                "name": "instructor_id",
                "type": "INT",
                "nullable": True,
                "isForeign": True,
                "references": {"table": "professors", "column": "id"},
            },
        ],
    },
    "enrollments": {
        "name": "enrollments",
        "rowCount": 45000,
        "primaryKey": "id",
        "columns": [
            {"name": "id", "type": "INT", "nullable": False, "isPrimary": True, "indexed": True},
            {
                "name": "student_id",
                "type": "INT",
                "nullable": False,
                "isForeign": True,
                "references": {"table": "students", "column": "id"},
                "indexed": True,
            },
            {
                "name": "course_id",
                "type": "INT",
                "nullable": False,
                "isForeign": True,
                "references": {"table": "courses", "column": "id"},
                "indexed": True,
            },
            {"name": "semester", "type": "VARCHAR", "nullable": False},
            {"name": "grade", "type": "VARCHAR", "nullable": True},
            {"name": "score", "type": "FLOAT", "nullable": True},
        ],
    },
    "professors": {
        "name": "professors",
        "rowCount": 120,
        "primaryKey": "id",
        "columns": [
            {"name": "id", "type": "INT", "nullable": False, "isPrimary": True, "indexed": True},
            {"name": "name", "type": "VARCHAR", "nullable": False},
            {"name": "title", "type": "VARCHAR", "nullable": False},
            {"name": "salary", "type": "FLOAT", "nullable": False},
            {
                "name": "dept_id",
                "type": "INT",
                "nullable": False,
                "isForeign": True,
                "references": {"table": "departments", "column": "id"},
            },
        ],
    },
}


def get_catalog(custom_catalog: Optional[Dict[str, Any]] = None) -> Dict[str, Dict[str, Any]]:
    """Return custom catalog if provided and non-empty, otherwise return UNIVERSITY_CATALOG."""
    if custom_catalog and isinstance(custom_catalog, dict) and len(custom_catalog) > 0:
        return custom_catalog
    return UNIVERSITY_CATALOG
