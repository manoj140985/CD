import React, { useState, useMemo } from 'react';
import { LexerResult, Token, TokenType } from '../../types/compiler';
import { Search, Hash, Cpu, AlertTriangle, Filter } from 'lucide-react';

interface LexicalPhaseProps {
  lexer: LexerResult;
}

export const LexicalPhase: React.FC<LexicalPhaseProps> = ({ lexer }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedToken, setSelectedToken] = useState<Token | null>(lexer.tokens[0] || null);

  const filteredTokens = useMemo(() => {
    return lexer.tokens.filter(tok => {
      const matchesSearch =
        tok.value.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tok.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tok.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = selectedType === 'ALL' || tok.type === selectedType;
      return matchesSearch && matchesType;
    });
  }, [lexer.tokens, searchTerm, selectedType]);

  const getTypeBadgeClass = (type: TokenType) => {
    switch (type) {
      case 'KEYWORD':
        return 'bg-cyan-950/60 text-cyan-300 border-cyan-800/80';
      case 'IDENTIFIER':
        return 'bg-indigo-950/60 text-indigo-300 border-indigo-800/80';
      case 'LITERAL_STRING':
      case 'LITERAL_NUMBER':
        return 'bg-amber-950/60 text-amber-300 border-amber-800/80';
      case 'OPERATOR':
        return 'bg-rose-950/60 text-rose-300 border-rose-800/80';
      case 'PUNCTUATION':
        return 'bg-slate-800 text-slate-300 border-slate-700';
      case 'COMMENT':
        return 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header and KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3 rounded-xl border border-slate-800 bg-[#0d131f]">
          <div className="text-[11px] font-mono text-slate-500 uppercase">Total Tokens</div>
          <div className="text-xl font-bold text-slate-100 font-mono tabular-nums mt-1">{lexer.tokenCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Scanned in {lexer.durationMs}ms</div>
        </div>

        <div className="p-3 rounded-xl border border-slate-800 bg-[#0d131f]">
          <div className="text-[11px] font-mono text-cyan-400 uppercase">Keywords</div>
          <div className="text-xl font-bold text-cyan-300 font-mono tabular-nums mt-1">{lexer.stats.keywords}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">SQL Reserved</div>
        </div>

        <div className="p-3 rounded-xl border border-slate-800 bg-[#0d131f]">
          <div className="text-[11px] font-mono text-indigo-400 uppercase">Identifiers</div>
          <div className="text-xl font-bold text-indigo-300 font-mono tabular-nums mt-1">{lexer.stats.identifiers}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Tables & Columns</div>
        </div>

        <div className="p-3 rounded-xl border border-slate-800 bg-[#0d131f]">
          <div className="text-[11px] font-mono text-amber-400 uppercase">Literals</div>
          <div className="text-xl font-bold text-amber-300 font-mono tabular-nums mt-1">{lexer.stats.literals}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Strings & Numbers</div>
        </div>

        <div className="p-3 rounded-xl border border-slate-800 bg-[#0d131f]">
          <div className="text-[11px] font-mono text-rose-400 uppercase">Operators</div>
          <div className="text-xl font-bold text-rose-300 font-mono tabular-nums mt-1">{lexer.stats.operators}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Relational & Math</div>
        </div>
      </div>

      {/* Lexical Error Alert if any */}
      {lexer.errors.length > 0 && (
        <div className="p-3 rounded-lg border border-rose-500/50 bg-rose-950/30 text-rose-200 text-xs flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-rose-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-rose-100">Lexical Scanner Warnings</div>
            <ul className="list-disc list-inside mt-1 space-y-0.5 text-rose-300 font-mono text-[11px]">
              {lexer.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Main Split: Tokens Grid and Token Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Token Table */}
        <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-[#0d131f] flex flex-col overflow-hidden">
          {/* Table Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b border-slate-800/80 bg-slate-900/60 text-xs">
            {/* Search */}
            <div className="relative flex-1 min-w-[160px]">
              <Search size={13} className="absolute left-2.5 top-2.5 text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search token value, type, category..."
                className="w-full pl-8 pr-3 py-1.5 rounded-md bg-slate-950/70 border border-slate-700/80 text-slate-200 placeholder:text-slate-500 text-xs outline-none focus:border-cyan-500"
              />
            </div>

            {/* Type Filter Buttons */}
            <div className="flex items-center gap-1 overflow-x-auto">
              {['ALL', 'KEYWORD', 'IDENTIFIER', 'LITERAL_NUMBER', 'OPERATOR'].map(type => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                    selectedType === type
                      ? 'bg-cyan-500 text-slate-950 font-semibold'
                      : 'bg-slate-800/60 text-slate-400 hover:text-white'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Tokens List / Table */}
          <div className="max-h-[380px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-900/90 backdrop-blur border-b border-slate-800 text-[11px] font-mono text-slate-400">
                <tr>
                  <th className="py-2 px-3 w-12">#</th>
                  <th className="py-2 px-3">Token Value</th>
                  <th className="py-2 px-3">Token Type</th>
                  <th className="py-2 px-3">Category</th>
                  <th className="py-2 px-3 text-right">Position (L:C)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 font-mono">
                {filteredTokens.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                      No tokens match current filter
                    </td>
                  </tr>
                ) : (
                  filteredTokens.map(tok => {
                    const isSelected = selectedToken?.id === tok.id;
                    return (
                      <tr
                        key={tok.id}
                        onClick={() => setSelectedToken(tok)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-cyan-950/40 text-cyan-200' : 'hover:bg-slate-800/40 text-slate-300'
                        }`}
                      >
                        <td className="py-1.5 px-3 text-slate-500 text-[11px]">{tok.id}</td>
                        <td className="py-1.5 px-3 font-semibold text-slate-100">
                          {tok.value}
                        </td>
                        <td className="py-1.5 px-3">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono border ${getTypeBadgeClass(tok.type)}`}>
                            {tok.type}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 text-slate-400 text-[11px]">
                          {tok.category}
                        </td>
                        <td className="py-1.5 px-3 text-right text-slate-500 text-[11px] tabular-nums">
                          {tok.line}:{tok.column}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Token Details Inspector Card */}
        <div className="rounded-xl border border-slate-800 bg-[#0d131f] p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <Cpu size={15} className="text-cyan-400" />
                <span className="font-semibold text-slate-200 text-xs">Token Inspector</span>
              </div>
              {selectedToken && (
                <span className="text-[11px] font-mono text-slate-500">ID #{selectedToken.id}</span>
              )}
            </div>

            {selectedToken ? (
              <div className="space-y-3 text-xs">
                <div>
                  <div className="text-[10px] uppercase font-mono text-slate-500">Lexeme (Raw Value)</div>
                  <div className="mt-1 p-2 rounded bg-slate-950/80 border border-slate-800 font-mono text-sm text-cyan-300 break-all">
                    {selectedToken.value}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded bg-slate-950/40 border border-slate-800/80">
                    <div className="text-[10px] uppercase font-mono text-slate-500">Token Type</div>
                    <div className="font-mono text-slate-200 mt-0.5">{selectedToken.type}</div>
                  </div>
                  <div className="p-2 rounded bg-slate-950/40 border border-slate-800/80">
                    <div className="text-[10px] uppercase font-mono text-slate-500">Category</div>
                    <div className="font-mono text-slate-200 mt-0.5">{selectedToken.category}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded bg-slate-950/40 border border-slate-800/80">
                    <div className="text-[10px] uppercase font-mono text-slate-500">Line Number</div>
                    <div className="font-mono text-slate-200 mt-0.5">{selectedToken.line}</div>
                  </div>
                  <div className="p-2 rounded bg-slate-950/40 border border-slate-800/80">
                    <div className="text-[10px] uppercase font-mono text-slate-500">Column Index</div>
                    <div className="font-mono text-slate-200 mt-0.5">{selectedToken.column}</div>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase font-mono text-slate-500">Scanner Regex Rule</div>
                  <div className="mt-1 p-2 rounded bg-slate-950/80 border border-slate-800 font-mono text-[11px] text-amber-300 break-all">
                    {selectedToken.regexRule}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500 text-xs">
                Select a token in the table to inspect lexical attributes
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Compiler Phase 1</span>
            <span className="font-mono">DFA Lexical Scanning</span>
          </div>
        </div>
      </div>
    </div>
  );
};
