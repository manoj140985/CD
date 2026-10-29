import {
  ASTNode,
  IntermediateResult,
  RelationalAlgebraNode,
  TACInstruction,
  TableSchema
} from '../types/compiler';
import { UNIVERSITY_CATALOG } from './catalog';

export function generateIntermediateRepresentation(
  ast: ASTNode,
  catalog: Record<string, TableSchema> = UNIVERSITY_CATALOG
): IntermediateResult {
  const startTime = performance.now();
  let nodeIdCounter = 1;
  const nextId = (prefix: string) => `${prefix}_${nodeIdCounter++}`;

  // 1. Extract pieces from AST
  let projectionCols: string[] = [];
  let fromTable: string = 'unknown';
  let fromAlias: string = '';
  const joins: { table: string; alias: string; type: string; condition: string }[] = [];
  let whereCondition: string = '';
  const groupByCols: string[] = [];
  const aggregateExprs: string[] = [];
  let havingCondition: string = '';
  let orderBySpec: string = '';
  let limitVal: number | null = null;

  const traverse = (node: ASTNode) => {
    if (node.type === 'ProjectionList') {
      node.children?.forEach(c => {
        if (c.type === 'ProjectionItem') {
          const expr = c.children?.[0];
          const raw = expr?.value || expr?.label || c.value || '*';
          const alias = c.attributes?.alias;
          projectionCols.push(alias ? `${raw} AS ${alias}` : raw);
          if (expr?.type === 'FunctionCall') {
            aggregateExprs.push(expr.label);
          }
        }
      });
    }

    if (node.type === 'TableReference' && fromTable === 'unknown') {
      fromTable = (node.attributes?.tableName || node.value || 'unknown').toLowerCase();
      fromAlias = node.attributes?.alias || fromTable;
    }

    if (node.type === 'JoinClause') {
      const targetTableNode = node.children?.[0];
      const condNode = node.children?.[1];
      const jTable = (targetTableNode?.attributes?.tableName || targetTableNode?.value || 'unknown').toLowerCase();
      const jAlias = targetTableNode?.attributes?.alias || jTable;
      const condStr = stringifyExpr(condNode);

      joins.push({
        table: jTable,
        alias: jAlias,
        type: node.attributes?.joinType || 'INNER',
        condition: condStr || 'TRUE'
      });
    }

    if (node.type === 'WhereClause') {
      whereCondition = stringifyExpr(node.children?.[0]);
    }

    if (node.type === 'GroupByClause') {
      node.children?.forEach(c => {
        groupByCols.push(stringifyExpr(c));
      });
    }

    if (node.type === 'HavingClause') {
      havingCondition = stringifyExpr(node.children?.[0]);
    }

    if (node.type === 'OrderByClause') {
      const items: string[] = [];
      node.children?.forEach(c => {
        items.push(`${stringifyExpr(c.children?.[0])} ${c.attributes?.direction || 'ASC'}`);
      });
      orderBySpec = items.join(', ');
    }

    if (node.type === 'LimitClause') {
      limitVal = node.attributes?.limit || null;
    }

    if (node.children) {
      node.children.forEach(traverse);
    }
  };

  traverse(ast);

  if (projectionCols.length === 0) projectionCols = ['*'];

  // 2. Build Unoptimized Relational Algebra Tree (Canonical Bottom-Up Construction)
  // Step A: Base Table Scan
  const baseTableCatalog = catalog[fromTable];
  const baseTableRows = baseTableCatalog ? baseTableCatalog.rowCount : 1000;

  let currentSubtree: RelationalAlgebraNode = {
    id: nextId('scan'),
    op: 'TABLE_SCAN',
    symbol: 'R',
    parameters: fromAlias && fromAlias !== fromTable ? `${fromTable} (${fromAlias})` : fromTable,
    estimatedRows: baseTableRows,
    cost: baseTableRows * 0.1,
    schema: baseTableCatalog ? baseTableCatalog.columns.map(c => `${fromAlias || fromTable}.${c.name}`) : ['*']
  };

  // Step B: Joins
  for (const join of joins) {
    const joinTableCatalog = catalog[join.table];
    const joinRows = joinTableCatalog ? joinTableCatalog.rowCount : 500;
    const rightScan: RelationalAlgebraNode = {
      id: nextId('scan'),
      op: 'TABLE_SCAN',
      symbol: 'R',
      parameters: join.alias && join.alias !== join.table ? `${join.table} (${join.alias})` : join.table,
      estimatedRows: joinRows,
      cost: joinRows * 0.1,
      schema: joinTableCatalog ? joinTableCatalog.columns.map(c => `${join.alias || join.table}.${c.name}`) : ['*']
    };

    // Unoptimized join joins the entire cross-product or un-filtered relations
    const combinedRows = Math.min(currentSubtree.estimatedRows * joinRows * 0.05, 500000);
    const joinCost = currentSubtree.cost + rightScan.cost + (currentSubtree.estimatedRows * joinRows * 0.01);

    currentSubtree = {
      id: nextId('join'),
      op: 'JOIN',
      symbol: '⨝',
      parameters: join.condition,
      estimatedRows: Math.round(combinedRows),
      cost: Math.round(joinCost),
      schema: [...currentSubtree.schema, ...rightScan.schema],
      children: [currentSubtree, rightScan]
    };
  }

  // Step C: Selection (WHERE Filter) in unoptimized plan sits on top of all Joins!
  if (whereCondition) {
    const filteredRows = Math.max(1, Math.round(currentSubtree.estimatedRows * 0.15));
    currentSubtree = {
      id: nextId('select'),
      op: 'SELECT',
      symbol: 'σ',
      parameters: whereCondition,
      estimatedRows: filteredRows,
      cost: Math.round(currentSubtree.cost + currentSubtree.estimatedRows * 0.05),
      schema: currentSubtree.schema,
      children: [currentSubtree]
    };
  }

  // Step D: Aggregation / GROUP BY
  if (groupByCols.length > 0 || aggregateExprs.length > 0) {
    const groupRows = groupByCols.length > 0 ? Math.max(1, Math.round(currentSubtree.estimatedRows * 0.1)) : 1;
    currentSubtree = {
      id: nextId('agg'),
      op: 'AGGREGATE',
      symbol: 'γ',
      parameters: `${groupByCols.join(', ')}; ${aggregateExprs.join(', ')}`,
      estimatedRows: groupRows,
      cost: Math.round(currentSubtree.cost + currentSubtree.estimatedRows * 0.08),
      schema: [...groupByCols, ...aggregateExprs],
      children: [currentSubtree]
    };
  }

  // Step E: HAVING
  if (havingCondition) {
    currentSubtree = {
      id: nextId('having'),
      op: 'SELECT',
      symbol: 'σ_having',
      parameters: havingCondition,
      estimatedRows: Math.max(1, Math.round(currentSubtree.estimatedRows * 0.5)),
      cost: Math.round(currentSubtree.cost + currentSubtree.estimatedRows * 0.02),
      schema: currentSubtree.schema,
      children: [currentSubtree]
    };
  }

  // Step F: Sort / ORDER BY
  if (orderBySpec) {
    currentSubtree = {
      id: nextId('sort'),
      op: 'SORT',
      symbol: 'τ',
      parameters: orderBySpec,
      estimatedRows: currentSubtree.estimatedRows,
      cost: Math.round(currentSubtree.cost + currentSubtree.estimatedRows * Math.log2(Math.max(2, currentSubtree.estimatedRows)) * 0.05),
      schema: currentSubtree.schema,
      children: [currentSubtree]
    };
  }

  // Step G: Projection (Topmost in unoptimized plan)
  currentSubtree = {
    id: nextId('proj'),
    op: 'PROJECT',
    symbol: 'π',
    parameters: projectionCols.join(', '),
    estimatedRows: currentSubtree.estimatedRows,
    cost: Math.round(currentSubtree.cost + currentSubtree.estimatedRows * 0.01),
    schema: projectionCols,
    children: [currentSubtree]
  };

  // Step H: Limit
  if (limitVal !== null) {
    currentSubtree = {
      id: nextId('limit'),
      op: 'LIMIT',
      symbol: 'λ',
      parameters: `limit: ${limitVal}`,
      estimatedRows: Math.min(currentSubtree.estimatedRows, limitVal),
      cost: currentSubtree.cost,
      schema: currentSubtree.schema,
      children: [currentSubtree]
    };
  }

  // 3. Build Mathematical Relational Algebra Notation Text
  const algebraText = buildAlgebraString(currentSubtree);

  // 4. Generate Three-Address Code (TAC) Instructions
  const tacInstructions: TACInstruction[] = [];
  let tacTempCounter = 1;
  const generateTAC = (node: RelationalAlgebraNode): string => {
    let childTemp1 = '';
    let childTemp2 = '';
    if (node.children && node.children.length > 0) {
      childTemp1 = generateTAC(node.children[0]);
    }
    if (node.children && node.children.length > 1) {
      childTemp2 = generateTAC(node.children[1]);
    }

    const res = `t${tacTempCounter++}`;

    switch (node.op) {
      case 'TABLE_SCAN':
        tacInstructions.push({
          index: tacInstructions.length + 1,
          op: 'SCAN',
          arg1: node.parameters,
          result: res,
          description: `Sequential or base relation scan of table ${node.parameters}`
        });
        break;
      case 'JOIN':
        tacInstructions.push({
          index: tacInstructions.length + 1,
          op: 'JOIN',
          arg1: childTemp1,
          arg2: `${childTemp2} ON (${node.parameters})`,
          result: res,
          description: `Relational join of ${childTemp1} and ${childTemp2} with join predicate`
        });
        break;
      case 'SELECT':
        tacInstructions.push({
          index: tacInstructions.length + 1,
          op: 'FILTER',
          arg1: childTemp1,
          arg2: node.parameters,
          result: res,
          description: `Filter tuples in ${childTemp1} satisfying (${node.parameters})`
        });
        break;
      case 'AGGREGATE':
        tacInstructions.push({
          index: tacInstructions.length + 1,
          op: 'GROUP_AGG',
          arg1: childTemp1,
          arg2: node.parameters,
          result: res,
          description: `Aggregate and group intermediate relation ${childTemp1}`
        });
        break;
      case 'SORT':
        tacInstructions.push({
          index: tacInstructions.length + 1,
          op: 'SORT',
          arg1: childTemp1,
          arg2: node.parameters,
          result: res,
          description: `Sort intermediate relation ${childTemp1} by ${node.parameters}`
        });
        break;
      case 'PROJECT':
        tacInstructions.push({
          index: tacInstructions.length + 1,
          op: 'PROJECT',
          arg1: childTemp1,
          arg2: `[${node.parameters}]`,
          result: res,
          description: `Project selected attributes from ${childTemp1}`
        });
        break;
      case 'LIMIT':
        tacInstructions.push({
          index: tacInstructions.length + 1,
          op: 'LIMIT',
          arg1: childTemp1,
          arg2: node.parameters,
          result: res,
          description: `Truncate result stream to ${node.parameters}`
        });
        break;
    }

    return res;
  };

  const finalTemp = generateTAC(currentSubtree);
  tacInstructions.push({
    index: tacInstructions.length + 1,
    op: 'RETURN',
    arg1: finalTemp,
    result: 'OUTPUT_STREAM',
    description: `Emit resulting tuple stream ${finalTemp} to caller`
  });

  const durationMs = parseFloat((performance.now() - startTime).toFixed(2));

  return {
    algebraTree: currentSubtree,
    algebraText,
    tacInstructions,
    durationMs
  };
}

function stringifyExpr(node?: ASTNode): string {
  if (!node) return '';
  if (node.type === 'BinaryExpression') {
    const left = stringifyExpr(node.children?.[0]);
    const right = stringifyExpr(node.children?.[1]);
    return `${left} ${node.value} ${right}`;
  }
  if (node.type === 'FunctionCall') {
    const arg = stringifyExpr(node.children?.[0]);
    return `${node.value}(${arg})`;
  }
  if (node.type === 'Literal') {
    return node.attributes?.rawType === 'VARCHAR' ? `'${node.value}'` : (node.value || '');
  }
  if (node.type === 'Identifier') {
    return node.attributes?.identifier || node.value || '';
  }
  if (node.type === 'Subquery') {
    return `(SELECT ...)`;
  }
  return node.value || node.label || '';
}

function buildAlgebraString(node: RelationalAlgebraNode): string {
  if (node.op === 'TABLE_SCAN') {
    return node.parameters;
  }
  if (node.children && node.children.length === 1) {
    const inner = buildAlgebraString(node.children[0]);
    return `${node.symbol}_{${node.parameters}}(${inner})`;
  }
  if (node.children && node.children.length === 2) {
    const left = buildAlgebraString(node.children[0]);
    const right = buildAlgebraString(node.children[1]);
    return `(${left} ${node.symbol}_{${node.parameters}} ${right})`;
  }
  return node.parameters;
}
