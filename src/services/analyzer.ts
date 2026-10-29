import { ASTNode, Diagnostic, SemanticResult, SymbolTableEntry, TableSchema } from '../types/compiler';
import { UNIVERSITY_CATALOG } from './catalog';

interface TableBinding {
  alias: string;
  tableName: string;
  schema?: TableSchema;
}

export function analyzeSemantics(
  ast: ASTNode,
  catalog: Record<string, TableSchema> = UNIVERSITY_CATALOG
): SemanticResult {
  const startTime = performance.now();
  const diagnostics: Diagnostic[] = [];
  const symbolTable: SymbolTableEntry[] = [];
  const tableBindings: Map<string, TableBinding> = new Map();
  const resolvedTables: Set<string> = new Set();
  const resolvedColumns: Set<string> = new Set();

  let diagId = 1;
  const addDiag = (
    severity: 'error' | 'warning' | 'info',
    code: string,
    message: string,
    line?: number,
    column?: number,
    hint?: string
  ) => {
    diagnostics.push({
      id: `diag_${diagId++}`,
      severity,
      code,
      message,
      line,
      column,
      hint
    });
  };

  // 1. Gather all TableReferences and Joins
  const tableNodes: ASTNode[] = [];
  const findTables = (node: ASTNode) => {
    if (node.type === 'TableReference') {
      tableNodes.push(node);
    }
    if (node.children) {
      node.children.forEach(findTables);
    }
  };
  findTables(ast);

  if (tableNodes.length === 0) {
    addDiag('error', 'ERR_MISSING_TABLE', 'Query does not specify any table in the FROM clause.', 1, 1, 'Add a FROM clause with a valid table name');
  }

  // Register table bindings into symbol table and check table existence
  for (const tNode of tableNodes) {
    const rawTableName = (tNode.attributes?.tableName || tNode.value || '').toLowerCase();
    const alias = (tNode.attributes?.alias || rawTableName).toLowerCase();
    const schema = catalog[rawTableName];

    if (!schema) {
      addDiag(
        'error',
        'ERR_TABLE_NOT_FOUND',
        `Table '${rawTableName}' does not exist in relational catalog.`,
        tNode.line || 1,
        tNode.column || 1,
        `Available catalog tables: ${Object.keys(catalog).join(', ')}`
      );
    } else {
      resolvedTables.add(rawTableName);
      symbolTable.push({
        name: rawTableName,
        category: 'TABLE',
        dataType: 'RELATION',
        scope: 'GLOBAL',
        isNullable: false,
        sourceLine: tNode.line || 1
      });
    }

    if (alias !== rawTableName) {
      symbolTable.push({
        name: alias,
        category: 'ALIAS',
        dataType: `ALIAS_OF(${rawTableName})`,
        scope: 'QUERY',
        resolvedTable: rawTableName,
        isNullable: false,
        sourceLine: tNode.line || 1
      });
    }

    tableBindings.set(alias, { alias, tableName: rawTableName, schema });
    // Also bind raw table name if alias differs
    if (!tableBindings.has(rawTableName)) {
      tableBindings.set(rawTableName, { alias, tableName: rawTableName, schema });
    }
  }

  // 2. Resolve identifiers (Column references)
  const identifierNodes: ASTNode[] = [];
  const findIdentifiers = (node: ASTNode) => {
    if (node.type === 'Identifier') {
      identifierNodes.push(node);
    }
    if (node.children) {
      node.children.forEach(findIdentifiers);
    }
  };
  findIdentifiers(ast);

  for (const idNode of identifierNodes) {
    const rawId = idNode.attributes?.identifier || idNode.value || '';
    const parts = rawId.split('.');

    if (parts.length === 2) {
      // Qualified identifier: tableOrAlias.columnName
      const qualifier = parts[0].toLowerCase();
      const colName = parts[1].toLowerCase();

      const binding = tableBindings.get(qualifier);
      if (!binding) {
        addDiag(
          'error',
          'ERR_UNKNOWN_TABLE_ALIAS',
          `Unknown table or alias qualifier '${qualifier}' in '${rawId}'.`,
          idNode.line,
          idNode.column,
          `Did you forget to add '${qualifier}' to the FROM or JOIN clause?`
        );
      } else if (binding.schema) {
        const colDef = binding.schema.columns.find(c => c.name.toLowerCase() === colName);
        if (!colDef && colName !== '*') {
          addDiag(
            'error',
            'ERR_COLUMN_NOT_FOUND',
            `Column '${colName}' not found in table '${binding.tableName}'.`,
            idNode.line,
            idNode.column,
            `Available columns in '${binding.tableName}': ${binding.schema.columns.map(c => c.name).join(', ')}`
          );
        } else if (colDef) {
          resolvedColumns.add(`${binding.tableName}.${colDef.name}`);
          symbolTable.push({
            name: rawId,
            category: 'COLUMN',
            dataType: colDef.type,
            scope: qualifier,
            resolvedTable: binding.tableName,
            isNullable: colDef.nullable,
            sourceLine: idNode.line || 1
          });
        }
      }
    } else if (parts.length === 1 && rawId !== '*') {
      // Unqualified identifier: columnName
      const colName = parts[0].toLowerCase();
      const matchingBindings: { binding: TableBinding; colType: string; nullable: boolean }[] = [];

      for (const [, binding] of tableBindings.entries()) {
        if (binding.schema) {
          const colDef = binding.schema.columns.find(c => c.name.toLowerCase() === colName);
          if (colDef) {
            // Avoid duplicate table entries from alias
            if (!matchingBindings.some(m => m.binding.tableName === binding.tableName)) {
              matchingBindings.push({ binding, colType: colDef.type, nullable: colDef.nullable });
            }
          }
        }
      }

      if (matchingBindings.length === 0) {
        // Only warn/error if we have at least one valid table
        if (resolvedTables.size > 0) {
          addDiag(
            'error',
            'ERR_COLUMN_NOT_FOUND',
            `Unqualified column '${colName}' does not exist in any referenced table.`,
            idNode.line,
            idNode.column,
            `Check spelling or prefix with table alias (e.g., s.${colName})`
          );
        }
      } else if (matchingBindings.length > 1) {
        addDiag(
          'error',
          'ERR_AMBIGUOUS_COLUMN',
          `Column '${colName}' is ambiguous; it exists in tables: ${matchingBindings.map(m => m.binding.tableName).join(', ')}.`,
          idNode.line,
          idNode.column,
          `Disambiguate by prefixing the column with the table alias (e.g., ${matchingBindings[0].binding.alias}.${colName})`
        );
      } else {
        const match = matchingBindings[0];
        resolvedColumns.add(`${match.binding.tableName}.${colName}`);
        symbolTable.push({
          name: colName,
          category: 'COLUMN',
          dataType: match.colType,
          scope: match.binding.tableName,
          resolvedTable: match.binding.tableName,
          isNullable: match.nullable,
          sourceLine: idNode.line || 1
        });
      }
    }
  }

  // 3. Type Checking in Binary Expressions (Comparisons)
  const checkTypesInExpressions = (node: ASTNode) => {
    if (node.type === 'BinaryExpression' && ['>', '<', '>=', '<=', '=', '!=', '<>'].includes(node.value || '')) {
      const left = node.children?.[0];
      const right = node.children?.[1];

      if (left && right) {
        // e.g. age > 'twenty'
        const isLeftNum = isNumericExpression(left, tableBindings);
        const isRightStr = right.type === 'Literal' && right.attributes?.rawType === 'VARCHAR';
        
        if (isLeftNum && isRightStr) {
          addDiag(
            'warning',
            'WARN_TYPE_MISMATCH',
            `Type mismatch in comparison '${node.value}': comparing numeric attribute with string literal '${right.value}'.`,
            right.line || node.line,
            right.column || node.column,
            'SQL engine will attempt implicit string-to-numeric coercion, which may cause runtime execution failure.'
          );
        }
      }
    }

    if (node.children) {
      node.children.forEach(checkTypesInExpressions);
    }
  };
  checkTypesInExpressions(ast);

  // 4. Aggregations vs Group By Semantic Checking
  let hasAggregates = false;
  let hasGroupBy = false;
  const nonAggColsInSelect: string[] = [];
  const groupByCols: string[] = [];

  const inspectSelect = (node: ASTNode) => {
    if (node.type === 'FunctionCall') {
      hasAggregates = true;
    }
    if (node.type === 'GroupByClause') {
      hasGroupBy = true;
      node.children?.forEach(c => {
        if (c.type === 'Identifier') groupByCols.push(c.value?.toLowerCase() || '');
      });
    }
    if (node.type === 'ProjectionItem') {
      // Check if child is a plain column
      const child = node.children?.[0];
      if (child && child.type === 'Identifier') {
        nonAggColsInSelect.push(child.value?.toLowerCase() || '');
      }
    }
    if (node.children) {
      node.children.forEach(inspectSelect);
    }
  };
  inspectSelect(ast);

  if (hasAggregates && !hasGroupBy && nonAggColsInSelect.length > 0) {
    addDiag(
      'error',
      'ERR_AGGREGATE_WITHOUT_GROUP_BY',
      `Column '${nonAggColsInSelect[0]}' must appear in the GROUP BY clause or be used in an aggregate function.`,
      1,
      1,
      `Add 'GROUP BY ${nonAggColsInSelect.join(', ')}' or wrap '${nonAggColsInSelect[0]}' in an aggregate function`
    );
  }

  // Add info diagnostic if indexing is leveraged
  for (const resCol of resolvedColumns) {
    const [t, c] = resCol.split('.');
    const tbl = catalog[t];
    const colObj = tbl?.columns.find(x => x.name.toLowerCase() === c.toLowerCase());
    if (colObj?.indexed) {
      diagnostics.push({
        id: `diag_info_${diagId++}`,
        severity: 'info',
        code: 'INFO_INDEX_AVAILABLE',
        message: `Indexed attribute detected: '${resCol}' has a B-Tree index defined in catalog.`,
        hint: 'Can be used by execution engine for Index Scan.'
      });
      break;
    }
  }

  const durationMs = parseFloat((performance.now() - startTime).toFixed(2));
  const hasErrors = diagnostics.some(d => d.severity === 'error');

  return {
    isValid: !hasErrors,
    symbolTable,
    diagnostics,
    resolvedTables: Array.from(resolvedTables),
    resolvedColumns: Array.from(resolvedColumns),
    durationMs
  };
}

function isNumericExpression(node: ASTNode, bindings: Map<string, TableBinding>): boolean {
  if (node.type === 'Literal' && node.attributes?.rawType === 'INT_OR_FLOAT') return true;
  if (node.type === 'Identifier') {
    const raw = node.attributes?.identifier || node.value || '';
    const parts = raw.split('.');
    if (parts.length === 2) {
      const binding = bindings.get(parts[0].toLowerCase());
      const col = binding?.schema?.columns.find(c => c.name.toLowerCase() === parts[1].toLowerCase());
      return col?.type === 'INT' || col?.type === 'FLOAT';
    }
  }
  return false;
}
