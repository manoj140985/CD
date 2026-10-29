import React, { useState } from 'react';
import { TableSchema } from '../types/compiler';
import { UNIVERSITY_CATALOG } from '../services/catalog';
import { Database, Key, Hash, X, Check, Search } from 'lucide-react';

interface SchemaModalProps {
  isOpen: boolean;
  onClose: () => void;
  catalog?: Record<string, TableSchema>;
}

export const SchemaModal: React.FC<SchemaModalProps> = ({
  isOpen,
  onClose,
  catalog = UNIVERSITY_CATALOG
}) => {
  const [selectedTable, setSelectedTable] = useState<string>('students');
  const [searchCol, setSearchCol] = useState<string>('');

  if (!isOpen) return null;

  const currentSchema = catalog[selectedTable] || Object.values(catalog)[0];
  const filteredCols = currentSchema?.columns.filter(c =>
    c.name.toLowerCase().includes(searchCol.toLowerCase()) ||
    c.type.toLowerCase().includes(searchCol.toLowerCase())
  ) || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-4xl max-h-[85vh] rounded-2xl border border-slate-700/80 bg-[#0d131f] shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-950/60 border border-cyan-800/80 flex items-center justify-center text-cyan-400">
              <Database size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Relational Database Catalog</h2>
              <p className="text-xs text-slate-400">
                System Catalog used for Semantic Analysis, Column Resolution, and Cost Estimation
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Table Selector Sidebar */}
          <div className="w-full md:w-60 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-950/40 p-3 space-y-1 overflow-y-auto">
            <div className="px-2 py-1 text-[11px] font-mono uppercase text-slate-500">
              Catalog Tables ({Object.keys(catalog).length})
            </div>
            {Object.values(catalog).map(tbl => (
              <button
                key={tbl.name}
                onClick={() => setSelectedTable(tbl.name)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-colors flex items-center justify-between ${
                  selectedTable === tbl.name
                    ? 'bg-cyan-500/10 text-cyan-300 font-semibold border border-cyan-500/30'
                    : 'text-slate-300 hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Database size={13} className={selectedTable === tbl.name ? 'text-cyan-400' : 'text-slate-500'} />
                  <span className="truncate">{tbl.name}</span>
                </div>
                <span className="text-[10px] font-mono text-slate-500 tabular-nums">
                  {tbl.rowCount.toLocaleString()}
                </span>
              </button>
            ))}
          </div>

          {/* Table Details */}
          <div className="flex-1 p-5 flex flex-col overflow-y-auto space-y-4">
            {/* Table Meta Card */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-800 bg-slate-900/50">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-100 font-mono">{currentSchema.name}</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950/80 text-cyan-300 border border-cyan-800/80">
                    Base Table
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Primary Key: <code className="text-cyan-300 font-mono">{currentSchema.primaryKey}</code>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Cardinality</span>
                  <span className="text-slate-200 font-bold tabular-nums">
                    {currentSchema.rowCount.toLocaleString()} rows
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Attributes</span>
                  <span className="text-slate-200 font-bold tabular-nums">
                    {currentSchema.columns.length} columns
                  </span>
                </div>
              </div>
            </div>

            {/* Column Search */}
            <div className="relative">
              <Search size={13} className="absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                value={searchCol}
                onChange={e => setSearchCol(e.target.value)}
                placeholder="Filter columns by name or type..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950/60 border border-slate-700/80 text-slate-200 placeholder:text-slate-500 text-xs outline-none focus:border-cyan-500"
              />
            </div>

            {/* Columns Table */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 overflow-hidden">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead className="bg-slate-900/80 border-b border-slate-800 text-[11px] text-slate-400">
                  <tr>
                    <th className="py-2.5 px-3">Column Name</th>
                    <th className="py-2.5 px-3">Data Type</th>
                    <th className="py-2.5 px-3">Nullable</th>
                    <th className="py-2.5 px-3">Key Constraint</th>
                    <th className="py-2.5 px-3 text-right">Indexed (B-Tree)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {filteredCols.map(col => (
                    <tr key={col.name} className="hover:bg-slate-800/30 text-slate-300">
                      <td className="py-2 px-3 font-semibold text-slate-100 flex items-center gap-1.5">
                        {col.isPrimary && <Key size={12} className="text-amber-400 shrink-0" />}
                        <span>{col.name}</span>
                      </td>
                      <td className="py-2 px-3 text-cyan-300">{col.type}</td>
                      <td className="py-2 px-3 text-slate-400">{col.nullable ? 'YES' : 'NO'}</td>
                      <td className="py-2 px-3">
                        {col.isPrimary ? (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950/60 text-amber-300 border border-amber-800/80">
                            PRIMARY KEY
                          </span>
                        ) : col.isForeign ? (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/80">
                            FK → {col.references?.table}.{col.references?.column}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {col.indexed ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                            <Check size={12} />
                            <span>Indexed</span>
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-900/60 text-xs text-slate-400">
          <span>Schema metadata loaded into compiler catalog</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
