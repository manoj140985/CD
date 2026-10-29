import { TableSchema } from '../types/compiler';

export const UNIVERSITY_CATALOG: Record<string, TableSchema> = {
  students: {
    name: 'students',
    rowCount: 10000,
    primaryKey: 'id',
    columns: [
      { name: 'id', type: 'INT', nullable: false, isPrimary: true, indexed: true },
      { name: 'name', type: 'VARCHAR', nullable: false },
      { name: 'email', type: 'VARCHAR', nullable: false, indexed: true },
      { name: 'age', type: 'INT', nullable: true },
      { name: 'gpa', type: 'FLOAT', nullable: true, indexed: true },
      { name: 'dept_id', type: 'INT', nullable: false, isForeign: true, references: { table: 'departments', column: 'id' } },
      { name: 'admission_year', type: 'INT', nullable: false }
    ]
  },
  departments: {
    name: 'departments',
    rowCount: 20,
    primaryKey: 'id',
    columns: [
      { name: 'id', type: 'INT', nullable: false, isPrimary: true, indexed: true },
      { name: 'name', type: 'VARCHAR', nullable: false },
      { name: 'code', type: 'VARCHAR', nullable: false, indexed: true },
      { name: 'budget', type: 'FLOAT', nullable: true },
      { name: 'building', type: 'VARCHAR', nullable: true }
    ]
  },
  courses: {
    name: 'courses',
    rowCount: 500,
    primaryKey: 'id',
    columns: [
      { name: 'id', type: 'INT', nullable: false, isPrimary: true, indexed: true },
      { name: 'title', type: 'VARCHAR', nullable: false },
      { name: 'code', type: 'VARCHAR', nullable: false, indexed: true },
      { name: 'credits', type: 'INT', nullable: false },
      { name: 'dept_id', type: 'INT', nullable: false, isForeign: true, references: { table: 'departments', column: 'id' } },
      { name: 'instructor_id', type: 'INT', nullable: true, isForeign: true, references: { table: 'professors', column: 'id' } }
    ]
  },
  enrollments: {
    name: 'enrollments',
    rowCount: 45000,
    primaryKey: 'id',
    columns: [
      { name: 'id', type: 'INT', nullable: false, isPrimary: true, indexed: true },
      { name: 'student_id', type: 'INT', nullable: false, isForeign: true, references: { table: 'students', column: 'id' }, indexed: true },
      { name: 'course_id', type: 'INT', nullable: false, isForeign: true, references: { table: 'courses', column: 'id' }, indexed: true },
      { name: 'semester', type: 'VARCHAR', nullable: false },
      { name: 'grade', type: 'VARCHAR', nullable: true },
      { name: 'score', type: 'FLOAT', nullable: true }
    ]
  },
  professors: {
    name: 'professors',
    rowCount: 120,
    primaryKey: 'id',
    columns: [
      { name: 'id', type: 'INT', nullable: false, isPrimary: true, indexed: true },
      { name: 'name', type: 'VARCHAR', nullable: false },
      { name: 'title', type: 'VARCHAR', nullable: false },
      { name: 'salary', type: 'FLOAT', nullable: false },
      { name: 'dept_id', type: 'INT', nullable: false, isForeign: true, references: { table: 'departments', column: 'id' } }
    ]
  }
};

export const SAMPLE_QUERIES = [
  {
    id: 'pushdown_demo',
    title: 'Selection Pushdown & Join',
    category: 'Optimization Benchmark',
    description: 'Demonstrates pushing filter conditions (s.gpa >= 3.8 AND d.budget > 500000) below a cross-table join to drastically reduce intermediate row counts.',
    sql: `SELECT s.name, s.gpa, d.name AS department
FROM students s
JOIN departments d ON s.dept_id = d.id
WHERE s.gpa >= 3.8 AND d.budget > 500000;`
  },
  {
    id: 'three_table_join',
    title: 'Multi-Join with Redundant Predicate',
    category: 'Join Reordering & Constant Folding',
    description: 'A 3-table join with constant arithmetic (2024 - 4) and constant condition (1 = 1) that tests algebraic simplification and projection pushdown.',
    sql: `SELECT s.id, s.name, c.title, e.grade
FROM students s
JOIN enrollments e ON s.id = e.student_id
JOIN courses c ON e.course_id = c.id
WHERE 1 = 1 AND s.admission_year >= (2024 - 4) AND c.credits = 4;`
  },
  {
    id: 'group_by_agg',
    title: 'Aggregation & Group By',
    category: 'Analytics Query',
    description: 'Evaluates aggregate functions (COUNT, AVG), GROUP BY grouping node, and HAVING filter clause.',
    sql: `SELECT d.name AS department, COUNT(s.id) AS total_students, AVG(s.gpa) AS avg_gpa
FROM departments d
JOIN students s ON d.id = s.dept_id
WHERE s.age >= 18
GROUP BY d.name
HAVING COUNT(s.id) > 10;`
  },
  {
    id: 'simple_filter',
    title: 'Simple Filter & Projection',
    category: 'Baseline Scanner & Parser',
    description: 'A single table query with numeric comparison and column selection.',
    sql: `SELECT id, name, gpa, email
FROM students
WHERE gpa > 3.5
ORDER BY gpa DESC
LIMIT 20;`
  },
  {
    id: 'semantic_error_demo',
    title: 'Semantic Catalog Errors (Diagnostic Test)',
    category: 'Compiler Diagnostics',
    description: 'Contains intentional semantic errors: non-existent table (alumni), non-existent column (dorm_room), and ambiguous reference.',
    sql: `SELECT s.id, dorm_room, c.invalid_col
FROM students s
JOIN courses c ON s.dept_id = c.dept_id
JOIN non_existing_table net ON s.id = net.sid
WHERE s.age > 'twenty';`
  }
];
