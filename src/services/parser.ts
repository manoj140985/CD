import { ASTNode, SyntaxResult, Token } from '../types/compiler';

export class SQLParser {
  private tokens: Token[];
  private current: number = 0;
  private grammarRulesApplied: Set<string> = new Set();
  private errors: SyntaxResult['errors'] = [];
  private nodeIdCounter: number = 1;

  constructor(tokens: Token[]) {
    // Filter out comments
    this.tokens = tokens.filter(t => t.type !== 'COMMENT');
  }

  private nextId(prefix: string = 'node'): string {
    return `${prefix}_${this.nodeIdCounter++}`;
  }

  private peek(): Token | undefined {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private isAtEnd(): boolean {
    return this.current >= this.tokens.length || this.peek()?.value === ';';
  }

  private check(value: string, type?: string): boolean {
    if (this.isAtEnd()) return false;
    const token = this.peek()!;
    if (type && token.type !== type) return false;
    return token.value.toUpperCase() === value.toUpperCase();
  }

  private match(...values: string[]): boolean {
    for (const val of values) {
      if (this.check(val)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private consume(expectedValue: string, message: string): Token {
    if (this.check(expectedValue)) return this.advance();
    const token = this.peek();
    const line = token ? token.line : 1;
    const column = token ? token.column : 1;
    const foundToken = token ? token.value : 'EOF';
    
    this.errors.push({
      message,
      line,
      column,
      expectedToken: expectedValue,
      foundToken,
      suggestion: `Add '${expectedValue}' before '${foundToken}'`
    });

    // Provide synthetic token so parsing can continue
    return {
      id: -1,
      type: 'KEYWORD',
      value: expectedValue,
      line,
      column,
      regexRule: 'synthetic',
      category: 'Clause'
    };
  }

  public parse(): SyntaxResult {
    const startTime = performance.now();
    this.grammarRulesApplied.add('QueryStatement -> SELECT ProjectionClause FROM TableClause [JoinClauses] [WhereClause] [GroupByClause] [OrderByClause] [LimitClause]');

    let astRoot: ASTNode;

    if (!this.check('SELECT')) {
      const firstTok = this.peek();
      this.errors.push({
        message: `Expected 'SELECT' at start of query, found '${firstTok?.value || 'EOF'}'`,
        line: firstTok?.line || 1,
        column: firstTok?.column || 1,
        expectedToken: 'SELECT',
        foundToken: firstTok?.value,
        suggestion: `Start your query with 'SELECT <columns> FROM <table>'`
      });

      astRoot = {
        id: this.nextId('error_root'),
        type: 'SelectStatement',
        label: 'SelectStatement (Incomplete)',
        grammarRule: 'QueryStatement -> <SyntaxError>',
        children: []
      };
    } else {
      astRoot = this.parseSelectStatement();
    }

    const durationMs = parseFloat((performance.now() - startTime).toFixed(2));
    const depth = this.calculateDepth(astRoot);
    const nodeCount = this.countNodes(astRoot);

    return {
      ast: astRoot,
      grammarRulesApplied: Array.from(this.grammarRulesApplied),
      depth,
      nodeCount,
      errors: this.errors,
      durationMs
    };
  }

  private parseSelectStatement(): ASTNode {
    this.consume('SELECT', "Expected 'SELECT'");
    this.grammarRulesApplied.add('SelectClause -> SELECT [DISTINCT] ProjectionList');

    let isDistinct = false;
    if (this.match('DISTINCT')) {
      isDistinct = true;
    }

    // 1. Projections
    const projectionListNode = this.parseProjectionList();

    // 2. FROM clause
    let fromNode: ASTNode | null = null;
    const joins: ASTNode[] = [];

    if (this.match('FROM')) {
      this.grammarRulesApplied.add('FromClause -> FROM TableReference [JoinClause*]');
      fromNode = this.parseTableReference();

      // Check for zero or more JOINs
      while (this.check('JOIN') || this.check('INNER') || this.check('LEFT') || this.check('RIGHT')) {
        let joinType = 'INNER';
        if (this.match('INNER')) {
          this.consume('JOIN', "Expected 'JOIN' after 'INNER'");
        } else if (this.match('LEFT')) {
          this.match('OUTER');
          this.consume('JOIN', "Expected 'JOIN' after 'LEFT'");
          joinType = 'LEFT';
        } else if (this.match('RIGHT')) {
          this.match('OUTER');
          this.consume('JOIN', "Expected 'JOIN' after 'RIGHT'");
          joinType = 'RIGHT';
        } else {
          this.consume('JOIN', "Expected 'JOIN'");
        }

        this.grammarRulesApplied.add(`JoinClause -> ${joinType} JOIN TableReference ON Condition`);
        const joinedTable = this.parseTableReference();
        
        let onConditionNode: ASTNode | null = null;
        if (this.match('ON')) {
          onConditionNode = this.parseExpression();
        }

        joins.push({
          id: this.nextId('join'),
          type: 'JoinClause',
          label: `${joinType} JOIN`,
          grammarRule: `JoinClause -> ${joinType} JOIN TableRef ON Expression`,
          attributes: { joinType },
          children: [joinedTable, ...(onConditionNode ? [onConditionNode] : [])]
        });
      }
    } else {
      this.errors.push({
        message: "Missing 'FROM' clause in query",
        line: this.peek()?.line || 1,
        column: this.peek()?.column || 1,
        expectedToken: 'FROM',
        foundToken: this.peek()?.value,
        suggestion: "Add 'FROM <table_name>' after column list"
      });
    }

    // 3. WHERE clause
    let whereNode: ASTNode | null = null;
    if (this.match('WHERE')) {
      this.grammarRulesApplied.add('WhereClause -> WHERE BooleanExpression');
      const condition = this.parseExpression();
      whereNode = {
        id: this.nextId('where'),
        type: 'WhereClause',
        label: 'WHERE Clause',
        grammarRule: 'WhereClause -> WHERE BooleanExpression',
        children: [condition]
      };
    }

    // 4. GROUP BY clause
    let groupByNode: ASTNode | null = null;
    if (this.match('GROUP')) {
      this.consume('BY', "Expected 'BY' after 'GROUP'");
      this.grammarRulesApplied.add('GroupByClause -> GROUP BY ColumnList');
      const groupCols = this.parseExpressionList();
      groupByNode = {
        id: this.nextId('group_by'),
        type: 'GroupByClause',
        label: 'GROUP BY Clause',
        grammarRule: 'GroupByClause -> GROUP BY ColumnList',
        children: groupCols
      };
    }

    // 5. HAVING clause
    let havingNode: ASTNode | null = null;
    if (this.match('HAVING')) {
      this.grammarRulesApplied.add('HavingClause -> HAVING BooleanExpression');
      const havingExpr = this.parseExpression();
      havingNode = {
        id: this.nextId('having'),
        type: 'HavingClause',
        label: 'HAVING Clause',
        grammarRule: 'HavingClause -> HAVING BooleanExpression',
        children: [havingExpr]
      };
    }

    // 6. ORDER BY clause
    let orderByNode: ASTNode | null = null;
    if (this.match('ORDER')) {
      this.consume('BY', "Expected 'BY' after 'ORDER'");
      this.grammarRulesApplied.add('OrderByClause -> ORDER BY OrderItemList');
      const orderItems = this.parseOrderByItems();
      orderByNode = {
        id: this.nextId('order_by'),
        type: 'OrderByClause',
        label: 'ORDER BY Clause',
        grammarRule: 'OrderByClause -> ORDER BY OrderItemList',
        children: orderItems
      };
    }

    // 7. LIMIT clause
    let limitNode: ASTNode | null = null;
    if (this.match('LIMIT')) {
      this.grammarRulesApplied.add('LimitClause -> LIMIT IntegerLiteral');
      const limitVal = this.peek()?.value || '10';
      this.advance();
      limitNode = {
        id: this.nextId('limit'),
        type: 'LimitClause',
        label: `LIMIT ${limitVal}`,
        grammarRule: 'LimitClause -> LIMIT IntegerLiteral',
        value: limitVal,
        attributes: { limit: parseInt(limitVal, 10) || 10 }
      };
    }

    const children: ASTNode[] = [projectionListNode];
    if (fromNode) children.push(fromNode);
    children.push(...joins);
    if (whereNode) children.push(whereNode);
    if (groupByNode) children.push(groupByNode);
    if (havingNode) children.push(havingNode);
    if (orderByNode) children.push(orderByNode);
    if (limitNode) children.push(limitNode);

    return {
      id: this.nextId('select_stmt'),
      type: 'SelectStatement',
      label: `SelectStatement${isDistinct ? ' [DISTINCT]' : ''}`,
      grammarRule: 'QueryStatement -> SELECT Projection FROM Source [Clauses]',
      attributes: { isDistinct },
      children
    };
  }

  private parseProjectionList(): ASTNode {
    this.grammarRulesApplied.add('ProjectionList -> ProjectionItem (, ProjectionItem)*');
    const items: ASTNode[] = [];

    do {
      if (this.check('*')) {
        this.advance();
        items.push({
          id: this.nextId('proj_star'),
          type: 'ProjectionItem',
          label: 'ProjectionItem: *',
          value: '*',
          grammarRule: 'ProjectionItem -> *'
        });
      } else {
        const expr = this.parseExpression();
        let alias: string | undefined = undefined;

        if (this.match('AS')) {
          alias = this.advance().value;
        } else if (this.peek() && this.peek()!.type === 'IDENTIFIER' && !['FROM', 'WHERE', 'JOIN', 'GROUP', 'ORDER', 'LIMIT', 'HAVING'].includes(this.peek()!.value.toUpperCase())) {
          alias = this.advance().value;
        }

        items.push({
          id: this.nextId('proj_item'),
          type: 'ProjectionItem',
          label: alias ? `ProjectionItem (${alias})` : `ProjectionItem`,
          value: alias,
          grammarRule: 'ProjectionItem -> Expression [AS Alias]',
          attributes: { alias },
          children: [expr]
        });
      }
    } while (this.match(','));

    return {
      id: this.nextId('proj_list'),
      type: 'ProjectionList',
      label: `ProjectionList (${items.length} items)`,
      grammarRule: 'ProjectionList -> ProjectionItem (, ProjectionItem)*',
      children: items
    };
  }

  private parseTableReference(): ASTNode {
    this.grammarRulesApplied.add('TableReference -> TableName [AS Alias]');
    const tableToken = this.advance();
    const tableName = tableToken ? tableToken.value : 'unknown_table';
    let alias: string | undefined = undefined;

    if (this.match('AS')) {
      alias = this.advance().value;
    } else if (this.peek() && this.peek()!.type === 'IDENTIFIER' && !['JOIN', 'INNER', 'LEFT', 'RIGHT', 'WHERE', 'GROUP', 'ORDER', 'ON', 'LIMIT'].includes(this.peek()!.value.toUpperCase())) {
      alias = this.advance().value;
    }

    return {
      id: this.nextId('table_ref'),
      type: 'TableReference',
      label: alias ? `Table: ${tableName} AS ${alias}` : `Table: ${tableName}`,
      value: tableName,
      grammarRule: 'TableReference -> TableName [AS Alias]',
      attributes: { tableName, alias: alias || tableName },
      line: tableToken?.line,
      column: tableToken?.column
    };
  }

  private parseExpression(): ASTNode {
    return this.parseLogicalOr();
  }

  private parseLogicalOr(): ASTNode {
    let expr = this.parseLogicalAnd();
    while (this.match('OR')) {
      this.grammarRulesApplied.add('BooleanExpression -> Term OR Term');
      const right = this.parseLogicalAnd();
      expr = {
        id: this.nextId('bin_or'),
        type: 'BinaryExpression',
        label: 'BinaryExpr: OR',
        value: 'OR',
        grammarRule: 'BooleanExpr -> BooleanExpr OR BooleanExpr',
        attributes: { operator: 'OR' },
        children: [expr, right]
      };
    }
    return expr;
  }

  private parseLogicalAnd(): ASTNode {
    let expr = this.parseComparison();
    while (this.match('AND')) {
      this.grammarRulesApplied.add('BooleanExpression -> Factor AND Factor');
      const right = this.parseComparison();
      expr = {
        id: this.nextId('bin_and'),
        type: 'BinaryExpression',
        label: 'BinaryExpr: AND',
        value: 'AND',
        grammarRule: 'BooleanExpr -> BooleanExpr AND BooleanExpr',
        attributes: { operator: 'AND' },
        children: [expr, right]
      };
    }
    return expr;
  }

  private parseComparison(): ASTNode {
    let expr = this.parseAdditive();
    const compOps = ['>=', '<=', '!=', '<>', '=', '>', '<', 'LIKE', 'IN'];

    for (const op of compOps) {
      if (this.check(op)) {
        this.advance();
        this.grammarRulesApplied.add(`ComparisonExpression -> Expr ${op} Expr`);
        const right = this.parseAdditive();
        return {
          id: this.nextId('comp_op'),
          type: 'BinaryExpression',
          label: `Comparison: ${op}`,
          value: op,
          grammarRule: `ComparisonExpr -> Expr ${op} Expr`,
          attributes: { operator: op },
          children: [expr, right]
        };
      }
    }

    return expr;
  }

  private parseAdditive(): ASTNode {
    let expr = this.parseMultiplicative();
    while (this.check('+') || this.check('-')) {
      const op = this.advance().value;
      const right = this.parseMultiplicative();
      expr = {
        id: this.nextId('math_add'),
        type: 'BinaryExpression',
        label: `Arithmetic: ${op}`,
        value: op,
        grammarRule: `ArithmeticExpr -> Expr ${op} Expr`,
        attributes: { operator: op },
        children: [expr, right]
      };
    }
    return expr;
  }

  private parseMultiplicative(): ASTNode {
    let expr = this.parsePrimary();
    while (this.check('*') || this.check('/')) {
      const op = this.advance().value;
      const right = this.parsePrimary();
      expr = {
        id: this.nextId('math_mul'),
        type: 'BinaryExpression',
        label: `Arithmetic: ${op}`,
        value: op,
        grammarRule: `ArithmeticExpr -> Expr ${op} Expr`,
        attributes: { operator: op },
        children: [expr, right]
      };
    }
    return expr;
  }

  private parsePrimary(): ASTNode {
    const token = this.peek();
    if (!token) {
      return {
        id: this.nextId('eof'),
        type: 'Literal',
        label: 'NULL',
        grammarRule: 'Primary -> NULL'
      };
    }

    // Parenthesized sub-expression
    if (this.match('(')) {
      // Subquery check
      if (this.check('SELECT')) {
        const subquery = this.parseSelectStatement();
        this.consume(')', "Expected ')' after subquery");
        return {
          id: this.nextId('subquery'),
          type: 'Subquery',
          label: 'Scalar Subquery',
          grammarRule: 'Primary -> ( SELECT ... )',
          children: [subquery]
        };
      }
      const expr = this.parseExpression();
      this.consume(')', "Expected ')' after expression");
      return expr;
    }

    // Aggregate function calls like COUNT(s.id), AVG(gpa), etc.
    const aggNames = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'];
    if (aggNames.includes(token.value.toUpperCase())) {
      const funcName = this.advance().value.toUpperCase();
      this.consume('(', `Expected '(' after function ${funcName}`);
      let argExpr: ASTNode;
      if (this.check('*')) {
        this.advance();
        argExpr = {
          id: this.nextId('star_arg'),
          type: 'Literal',
          label: '*',
          value: '*',
          grammarRule: 'FunctionArg -> *'
        };
      } else {
        argExpr = this.parseExpression();
      }
      this.consume(')', `Expected ')' after arguments of ${funcName}`);
      return {
        id: this.nextId('func_agg'),
        type: 'FunctionCall',
        label: `Aggregate: ${funcName}()`,
        value: funcName,
        grammarRule: 'FunctionCall -> FuncName ( Argument )',
        attributes: { function: funcName },
        children: [argExpr]
      };
    }

    // Number literal
    if (token.type === 'LITERAL_NUMBER') {
      this.advance();
      return {
        id: this.nextId('lit_num'),
        type: 'Literal',
        label: `Number: ${token.value}`,
        value: token.value,
        grammarRule: 'Literal -> NumberLiteral',
        attributes: { rawType: 'INT_OR_FLOAT', value: parseFloat(token.value) },
        line: token.line,
        column: token.column
      };
    }

    // String literal
    if (token.type === 'LITERAL_STRING') {
      this.advance();
      const cleanVal = token.value.replace(/^['"]|['"]$/g, '');
      return {
        id: this.nextId('lit_str'),
        type: 'Literal',
        label: `String: '${cleanVal}'`,
        value: cleanVal,
        grammarRule: 'Literal -> StringLiteral',
        attributes: { rawType: 'VARCHAR', value: cleanVal },
        line: token.line,
        column: token.column
      };
    }

    // Identifiers (e.g. `s.name`, `gpa`, `students.id`)
    if (token.type === 'IDENTIFIER' || token.type === 'KEYWORD') {
      this.advance();
      let fullIdentifier = token.value;

      // Handle table.column dot notation
      if (this.match('.')) {
        const colToken = this.peek();
        if (colToken && (colToken.type === 'IDENTIFIER' || colToken.value === '*')) {
          this.advance();
          fullIdentifier = `${token.value}.${colToken.value}`;
        }
      }

      return {
        id: this.nextId('col_ref'),
        type: 'Identifier',
        label: `Column: ${fullIdentifier}`,
        value: fullIdentifier,
        grammarRule: 'Identifier -> [TableQualifier.]ColumnName',
        attributes: { identifier: fullIdentifier },
        line: token.line,
        column: token.column
      };
    }

    // Fallback advance to avoid infinite loop
    this.advance();
    return {
      id: this.nextId('unknown'),
      type: 'Literal',
      label: `Token: ${token.value}`,
      value: token.value,
      grammarRule: 'Token -> Unknown'
    };
  }

  private parseExpressionList(): ASTNode[] {
    const list: ASTNode[] = [];
    do {
      list.push(this.parseExpression());
    } while (this.match(','));
    return list;
  }

  private parseOrderByItems(): ASTNode[] {
    const items: ASTNode[] = [];
    do {
      const expr = this.parseExpression();
      let direction = 'ASC';
      if (this.match('DESC')) {
        direction = 'DESC';
      } else if (this.match('ASC')) {
        direction = 'ASC';
      }
      items.push({
        id: this.nextId('order_item'),
        type: 'OrderByItem',
        label: `Order: ${direction}`,
        value: direction,
        grammarRule: 'OrderItem -> Expression [ASC | DESC]',
        attributes: { direction },
        children: [expr]
      });
    } while (this.match(','));
    return items;
  }

  private calculateDepth(node: ASTNode): number {
    if (!node.children || node.children.length === 0) return 1;
    return 1 + Math.max(...node.children.map(c => this.calculateDepth(c)));
  }

  private countNodes(node: ASTNode): number {
    if (!node.children || node.children.length === 0) return 1;
    return 1 + node.children.reduce((acc, c) => acc + this.countNodes(c), 0);
  }
}

export function parseSQL(tokens: Token[]): SyntaxResult {
  const parser = new SQLParser(tokens);
  return parser.parse();
}
