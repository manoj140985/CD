import React, { useState } from 'react';
import { FLASK_BACKEND_STARTER_CODE } from '../services/compilerEngine';
import { Server, Check, Copy, Activity, RefreshCw, X, AlertTriangle, Terminal, ExternalLink } from 'lucide-react';

interface BackendModalProps {
  isOpen: boolean;
  onClose: () => void;
  backendUrl: string;
  onUpdateBackendUrl: (url: string) => void;
  useRemoteBackend: boolean;
  onToggleRemoteBackend: (useRemote: boolean) => void;
}

export const BackendModal: React.FC<BackendModalProps> = ({
  isOpen,
  onClose,
  backendUrl,
  onUpdateBackendUrl,
  useRemoteBackend,
  onToggleRemoteBackend
}) => {
  const [activeTab, setActiveTab] = useState<'connection' | 'python_code' | 'api_spec'>('connection');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch(`${backendUrl}/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        setTestResult({
          success: true,
          message: `Connected successfully! Engine: ${data.engine || 'Python Flask'} (v${data.version || '1.0'})`
        });
      } else {
        setTestResult({
          success: false,
          message: `Endpoint reachable but returned HTTP ${response.status}: ${response.statusText}`
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Connection failed: ${err.message}. Ensure Flask server is running with 'flask-cors' enabled.`
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(FLASK_BACKEND_STARTER_CODE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-3xl max-h-[85vh] rounded-2xl border border-slate-700/80 bg-[#0d131f] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-950/60 border border-indigo-800/80 flex items-center justify-center text-indigo-400">
              <Server size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Python Flask Backend Integration</h2>
              <p className="text-xs text-slate-400">
                Connect the frontend to your university Compiler Design Python backend
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

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-800 bg-slate-950/40 text-xs">
          <button
            onClick={() => setActiveTab('connection')}
            className={`pb-2.5 px-3 font-medium transition-colors border-b-2 ${
              activeTab === 'connection'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Connection Settings
          </button>
          <button
            onClick={() => setActiveTab('python_code')}
            className={`pb-2.5 px-3 font-medium transition-colors border-b-2 ${
              activeTab === 'python_code'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Python Backend Starter Code
          </button>
          <button
            onClick={() => setActiveTab('api_spec')}
            className={`pb-2.5 px-3 font-medium transition-colors border-b-2 ${
              activeTab === 'api_spec'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            API JSON Specification
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 flex-1 overflow-y-auto">
          {activeTab === 'connection' && (
            <div className="space-y-5">
              {/* Engine Toggle */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm text-slate-100">Compiler Engine Mode</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Choose whether queries are compiled by the built-in simulator or via HTTP calls to a Python Flask backend.
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-medium">
                  <button
                    onClick={() => onToggleRemoteBackend(false)}
                    className={`px-3 py-1.5 rounded-md transition-all ${
                      !useRemoteBackend
                        ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Simulated Engine
                  </button>
                  <button
                    onClick={() => onToggleRemoteBackend(true)}
                    className={`px-3 py-1.5 rounded-md transition-all ${
                      useRemoteBackend
                        ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Live Flask Backend
                  </button>
                </div>
              </div>

              {/* Backend URL Input */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-200">
                  Flask Backend Base URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={backendUrl}
                    onChange={e => onUpdateBackendUrl(e.target.value)}
                    placeholder="http://localhost:5000"
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 font-mono text-xs text-slate-100 outline-none focus:border-cyan-500"
                  />
                  <button
                    onClick={handleTestConnection}
                    disabled={isTesting}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-600 transition-colors disabled:opacity-50"
                  >
                    {isTesting ? (
                      <RefreshCw size={13} className="animate-spin" />
                    ) : (
                      <Activity size={13} className="text-cyan-400" />
                    )}
                    <span>{isTesting ? 'Pinging...' : 'Test Ping'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Default local server port for Flask is usually <code>http://localhost:5000</code> or <code>http://127.0.0.1:5000</code>.
                </p>
              </div>

              {/* Ping Result Notification */}
              {testResult && (
                <div
                  className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                    testResult.success
                      ? 'border-emerald-500/50 bg-emerald-950/20 text-emerald-200'
                      : 'border-rose-500/50 bg-rose-950/20 text-rose-200'
                  }`}
                >
                  {testResult.success ? (
                    <Check size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="font-semibold">
                      {testResult.success ? 'Backend Status: Online' : 'Backend Status: Unreachable'}
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] opacity-90">{testResult.message}</div>
                  </div>
                </div>
              )}

              {/* Instructions Box */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-semibold text-slate-200">
                  <Terminal size={14} className="text-cyan-400" />
                  <span>How to Run the Python Flask Backend</span>
                </div>
                <div className="space-y-1.5 font-mono text-[11px] text-slate-300">
                  <div>1. Install dependencies: <code className="text-cyan-300 bg-slate-900 px-1.5 py-0.5 rounded">pip install flask flask-cors</code></div>
                  <div>2. Copy starter code from the next tab into <code className="text-indigo-300 bg-slate-900 px-1.5 py-0.5 rounded">app.py</code></div>
                  <div>3. Run server: <code className="text-cyan-300 bg-slate-900 px-1.5 py-0.5 rounded">python app.py</code></div>
                  <div>4. The server runs on port 5000 with endpoints <code className="text-amber-300">GET /health</code> and <code className="text-amber-300">POST /api/compile</code></div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'python_code' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400">app.py (Flask 3.x Starter)</span>
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold transition-colors"
                >
                  {copiedCode ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedCode ? 'Copied Python Code' : 'Copy app.py'}</span>
                </button>
              </div>

              <pre className="max-h-[380px] overflow-auto p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-cyan-200 selection:bg-cyan-500/30">
                {FLASK_BACKEND_STARTER_CODE}
              </pre>
            </div>
          )}

          {activeTab === 'api_spec' && (
            <div className="space-y-4 text-xs">
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 font-mono">
                <div className="text-cyan-400 font-bold mb-1">POST /api/compile</div>
                <div className="text-slate-400 text-[11px]">Request Payload:</div>
                <pre className="text-slate-200 mt-1 text-[11px]">
{`{
  "query": "SELECT s.name FROM students s WHERE s.gpa > 3.5;",
  "catalog": { ...tableSchemas }
}`}
                </pre>
              </div>

              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 font-mono">
                <div className="text-emerald-400 font-bold mb-1">Response JSON Contract:</div>
                <div className="text-slate-400 text-[11px]">Returns CompilerResult containing:</div>
                <ul className="list-disc list-inside mt-1 space-y-1 text-slate-300 text-[11px]">
                  <li><code>lexer</code>: tokens[], stats, durationMs</li>
                  <li><code>syntax</code>: ast (ASTNode tree), grammarRulesApplied[], errors[]</li>
                  <li><code>semantic</code>: isValid, symbolTable[], diagnostics[]</li>
                  <li><code>intermediate</code>: algebraTree, algebraText, tacInstructions[]</li>
                  <li><code>optimization</code>: unoptimizedTree, optimizedTree, rulesApplied[], metrics</li>
                  <li><code>executionPlan</code>: planTree, totalEstimatedCost, peakMemoryKb, explainText</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-900/60 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${useRemoteBackend ? 'bg-indigo-400' : 'bg-cyan-400'}`} />
            <span>Mode: {useRemoteBackend ? 'Python Flask Backend' : 'Built-in Simulation Engine'}</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
