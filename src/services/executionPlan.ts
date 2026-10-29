import {
  ExecutionPlanResult,
  PhysicalOperatorNode,
  RelationalAlgebraNode,
  TableSchema
} from '../types/compiler';
import { UNIVERSITY_CATALOG } from './catalog';

export function generateExecutionPlan(
  optimizedTree: RelationalAlgebraNode,
  catalog: Record<string, TableSchema> = UNIVERSITY_CATALOG
): ExecutionPlanResult {
  const startTime = performance.now();
  let nodeIdCounter = 1;
  const nextId = (prefix: string) => `phys_${prefix}_${nodeIdCounter++}`;

  const convertNode = (node: RelationalAlgebraNode): PhysicalOperatorNode => {
    let children: PhysicalOperatorNode[] | undefined = undefined;
    if (node.children && node.children.length > 0) {
      children = node.children.map(convertNode);
    }

    switch (node.op) {
      case 'TABLE_SCAN': {
        const rawTableName = (node.parameters.match(/\((.*?)\)/)?.[1] || node.parameters.split(' ')[0]).toLowerCase();
        const baseTable = catalog[rawTableName];
        const isIndexed = baseTable?.columns.some(c => c.indexed);

        // If table has index and is medium-to-large, use IndexScan
        if (isIndexed && (baseTable?.rowCount || 0) > 1000) {
          return {
            id: nextId('idx_scan'),
            operator: 'IndexScan',
            table: node.parameters,
            indexUsed: `idx_${rawTableName}_pk`,
            condition: 'Index Cond: (id = ?)',
            startupCost: 0.28,
            totalCost: Math.round(node.estimatedRows * 0.08 + 12),
            estimatedRows: node.estimatedRows,
            rowWidthBytes: 64,
            memoryKb: 32
          };
        }

        return {
          id: nextId('seq_scan'),
          operator: 'SeqScan',
          table: node.parameters,
          startupCost: 0.00,
          totalCost: Math.round(node.estimatedRows * 0.15 + 5),
          estimatedRows: node.estimatedRows,
          rowWidthBytes: 72,
          memoryKb: 16
        };
      }

      case 'SELECT': {
        const childCost = children?.[0]?.totalCost || 10;
        return {
          id: nextId('filter'),
          operator: 'Filter',
          condition: node.parameters,
          startupCost: children?.[0]?.startupCost || 0,
          totalCost: childCost + Math.round(node.estimatedRows * 0.02),
          estimatedRows: node.estimatedRows,
          rowWidthBytes: children?.[0]?.rowWidthBytes || 64,
          children
        };
      }

      case 'JOIN': {
        const left = children?.[0];
        const right = children?.[1];
        const leftCost = left?.totalCost || 10;
        const rightCost = right?.totalCost || 10;
        const totalRows = node.estimatedRows;

        // Determine join algorithm based on row sizes
        if ((left?.estimatedRows || 0) > 100 || (right?.estimatedRows || 0) > 100) {
          return {
            id: nextId('hash_join'),
            operator: 'HashJoin',
            condition: `Hash Cond: (${node.parameters})`,
            startupCost: Math.round(rightCost + 15),
            totalCost: Math.round(leftCost + rightCost + totalRows * 0.04 + 25),
            estimatedRows: totalRows,
            rowWidthBytes: (left?.rowWidthBytes || 40) + (right?.rowWidthBytes || 40),
            memoryKb: Math.max(64, Math.round((right?.estimatedRows || 10) * 0.12)),
            children
          };
        } else {
          return {
            id: nextId('nested_loop'),
            operator: 'NestedLoopJoin',
            condition: `Join Filter: (${node.parameters})`,
            startupCost: 0.00,
            totalCost: Math.round(leftCost + ((left?.estimatedRows || 1) * rightCost * 0.1)),
            estimatedRows: totalRows,
            rowWidthBytes: (left?.rowWidthBytes || 40) + (right?.rowWidthBytes || 40),
            memoryKb: 16,
            children
          };
        }
      }

      case 'AGGREGATE': {
        const childCost = children?.[0]?.totalCost || 20;
        return {
          id: nextId('hash_agg'),
          operator: 'HashAggregate',
          condition: `Group Key: ${node.parameters}`,
          startupCost: childCost,
          totalCost: childCost + Math.round(node.estimatedRows * 0.08 + 15),
          estimatedRows: node.estimatedRows,
          rowWidthBytes: 48,
          memoryKb: 128,
          children
        };
      }

      case 'SORT': {
        const childCost = children?.[0]?.totalCost || 20;
        return {
          id: nextId('sort'),
          operator: 'Sort',
          condition: `Sort Key: ${node.parameters}`,
          startupCost: childCost + Math.round(node.estimatedRows * 0.04),
          totalCost: childCost + Math.round(node.estimatedRows * 0.09 + 8),
          estimatedRows: node.estimatedRows,
          rowWidthBytes: children?.[0]?.rowWidthBytes || 56,
          memoryKb: Math.max(32, Math.round(node.estimatedRows * 0.08)),
          children
        };
      }

      case 'LIMIT': {
        const childCost = children?.[0]?.totalCost || 20;
        return {
          id: nextId('limit'),
          operator: 'Limit',
          condition: node.parameters,
          startupCost: children?.[0]?.startupCost || 0,
          totalCost: Math.round(childCost * 0.6),
          estimatedRows: node.estimatedRows,
          rowWidthBytes: children?.[0]?.rowWidthBytes || 56,
          children
        };
      }

      case 'PROJECT':
      default: {
        return children && children.length > 0
          ? children[0]
          : {
              id: nextId('proj'),
              operator: 'SeqScan',
              table: 'ResultStream',
              startupCost: 0,
              totalCost: 10,
              estimatedRows: node.estimatedRows,
              rowWidthBytes: 40
            };
      }
    }
  };

  const planTree = convertNode(optimizedTree);
  const totalEstimatedCost = planTree.totalCost;

  // Calculate peak memory across plan
  let peakMemory = 32;
  const calculateMem = (node: PhysicalOperatorNode) => {
    if (node.memoryKb && node.memoryKb > peakMemory) {
      peakMemory = node.memoryKb;
    }
    if (node.children) node.children.forEach(calculateMem);
  };
  calculateMem(planTree);

  // Generate standard EXPLAIN output text
  const explainLines: string[] = [];
  const buildExplain = (node: PhysicalOperatorNode, indent: number = 0) => {
    const spaces = '  '.repeat(indent);
    const costPart = `(cost=${node.startupCost.toFixed(2)}..${node.totalCost.toFixed(2)} rows=${node.estimatedRows} width=${node.rowWidthBytes})`;
    
    let line = `${spaces}->  ${node.operator}`;
    if (node.table) line += ` on ${node.table}`;
    line += `  ${costPart}`;
    explainLines.push(line);

    if (node.indexUsed) {
      explainLines.push(`${spaces}    Index Used: ${node.indexUsed}`);
    }
    if (node.condition) {
      explainLines.push(`${spaces}    ${node.condition}`);
    }
    if (node.memoryKb) {
      explainLines.push(`${spaces}    Peak WorkMem: ${node.memoryKb} kB`);
    }

    if (node.children) {
      for (const child of node.children) {
        buildExplain(child, indent + 1);
      }
    }
  };

  buildExplain(planTree);
  explainLines.push('');
  explainLines.push(`Planning Time: ${((performance.now() - startTime) + 0.14).toFixed(3)} ms`);
  explainLines.push(`Execution Engine: Volcano Pipeline Iterator (Pull-based)`);
  explainLines.push(`JIT Compilation: Available (Cost Threshold = 100,000)`);

  const durationMs = parseFloat((performance.now() - startTime).toFixed(2));

  return {
    planTree,
    totalEstimatedCost,
    peakMemoryKb: peakMemory,
    explainText: explainLines.join('\n'),
    durationMs
  };
}
