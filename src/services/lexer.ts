import { LexerResult, Token, TokenType } from '../types/compiler';

const KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL',
  'ON', 'AS', 'AND', 'OR', 'NOT', 'GROUP', 'BY', 'HAVING', 'ORDER',
  'ASC', 'DESC', 'LIMIT', 'OFFSET', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
  'IN', 'LIKE', 'BETWEEN', 'IS', 'NULL', 'TRUE', 'FALSE', 'DISTINCT',
  'UNION', 'ALL', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END'
]);

interface TokenRule {
  type: TokenType;
  regex: RegExp;
  category: Token['category'];
  rulePattern: string;
}

const TOKEN_RULES: TokenRule[] = [
  // Multi-line and single-line comments
  { type: 'COMMENT', regex: /^(--[^\n]*|\/\*[\s\S]*?\*\/)/, category: 'Other', rulePattern: `^(--[^\\n]*|/\\*[\\s\\S]*?\\*/)` },
  // String literal: '...' or "..."
  { type: 'LITERAL_STRING', regex: /^'([^'\\]|\\.)*'/, category: 'Literal', rulePattern: `^'([^'\\\\]|\\\\.)*'` },
  { type: 'LITERAL_STRING', regex: /^"([^"\\]|\\.)*"/, category: 'Literal', rulePattern: `^"([^"\\\\]|\\\\.)*"` },
  // Numeric literal
  { type: 'LITERAL_NUMBER', regex: /^\d+(\.\d+)?([eE][+-]?\d+)?/, category: 'Literal', rulePattern: `^\\d+(\\.\\d+)?` },
  // Comparison operators
  { type: 'OPERATOR', regex: /^(>=|<=|!=|<>|=|>|<)/, category: 'Comparison', rulePattern: `^(>=|<=|!=|<>|=|>|<)` },
  // Arithmetic operators
  { type: 'OPERATOR', regex: /^(\+|-|\*|\/|%)/, category: 'Other', rulePattern: `^(\\+|-|\\*|\\/|%)` },
  // Punctuations & Delimiters
  { type: 'PUNCTUATION', regex: /^(\(|\)|,|[.]|;)/, category: 'Delimiter', rulePattern: `^(\\(\\)|,|[.]|;)` },
  // Identifiers / Keywords
  { type: 'IDENTIFIER', regex: /^[a-zA-Z_][a-zA-Z0-9_]*/, category: 'Identifier', rulePattern: `^[a-zA-Z_][a-zA-Z0-9_]*` }
];

export function tokenize(sql: string): LexerResult {
  const startTime = performance.now();
  const tokens: Token[] = [];
  const errors: string[] = [];

  let line = 1;
  let column = 1;
  let cursor = 0;
  let tokenId = 1;

  while (cursor < sql.length) {
    const char = sql[cursor];

    // Handle newlines
    if (char === '\n') {
      line++;
      column = 1;
      cursor++;
      continue;
    }

    // Skip whitespace
    if (/\s/.test(char)) {
      column++;
      cursor++;
      continue;
    }

    const remaining = sql.slice(cursor);
    let matched = false;

    for (const rule of TOKEN_RULES) {
      const match = remaining.match(rule.regex);
      if (match && match.index === 0) {
        const rawValue = match[0];
        let tokenType = rule.type;
        let category = rule.category;

        // If matched as identifier, check if it's actually a SQL keyword
        if (tokenType === 'IDENTIFIER') {
          const upperVal = rawValue.toUpperCase();
          if (KEYWORDS.has(upperVal)) {
            tokenType = 'KEYWORD';
            if (['SELECT', 'FROM', 'WHERE', 'JOIN', 'GROUP', 'ORDER', 'HAVING', 'LIMIT'].includes(upperVal)) {
              category = 'Clause';
            } else if (['AND', 'OR', 'NOT'].includes(upperVal)) {
              category = 'Logical';
            } else {
              category = 'DML';
            }
          }
        }

        // We only add comments if desired, or skip them from AST parser
        tokens.push({
          id: tokenId++,
          type: tokenType,
          value: rawValue,
          line,
          column,
          regexRule: rule.rulePattern,
          category
        });

        cursor += rawValue.length;
        column += rawValue.length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      errors.push(`Unrecognized character '${char}' at line ${line}, column ${column}`);
      tokens.push({
        id: tokenId++,
        type: 'UNKNOWN',
        value: char,
        line,
        column,
        regexRule: `None (Unrecognized)`,
        category: 'Other'
      });
      cursor++;
      column++;
    }
  }

  const durationMs = parseFloat((performance.now() - startTime).toFixed(2));

  const stats = {
    keywords: tokens.filter(t => t.type === 'KEYWORD').length,
    identifiers: tokens.filter(t => t.type === 'IDENTIFIER').length,
    literals: tokens.filter(t => t.type === 'LITERAL_NUMBER' || t.type === 'LITERAL_STRING').length,
    operators: tokens.filter(t => t.type === 'OPERATOR').length,
    punctuations: tokens.filter(t => t.type === 'PUNCTUATION').length
  };

  return {
    tokens,
    tokenCount: tokens.length,
    stats,
    durationMs,
    errors
  };
}
