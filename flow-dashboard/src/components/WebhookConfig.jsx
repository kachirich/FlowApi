import React, { useState } from 'react';
import { Settings, X, Save, Loader2, Lock } from 'lucide-react';

export default function WebhookConfig({ 
  configModal, 
  onClose, 
  onSave, 
  planType,
  setUpgradeModal
}) {
  const [targetUrl, setTargetUrl] = useState(configModal.target_url || "");
  const [method, setMethod] = useState(configModal.http_method || "POST");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(configModal.id, targetUrl, method);
    setSaving(false);
  };

  const isAdvancedLocked = planType === 'free' || planType === 'basic';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in" onClick={onClose}>
      <div className="relative w-full max-w-md rounded-2xl border border-slate-700/60 bg-surface-raised p-6 shadow-2xl shadow-black/80 max-h-[90vh] overflow-y-auto custom-scrollbar" onClick={(e) => e.stopPropagation()}>
        
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-5">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Settings className="h-5 w-5 text-cyan-400" />
              Configure Webhook
            </h3>
            <p className="font-mono text-[10px] text-slate-500 mt-1">{configModal.masked_key}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Target URL</label>
            <input
              type="text"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)} 
              placeholder="https://your-destination.com/webhook" 
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 font-mono text-xs text-slate-200 outline-none transition focus:border-cyan-500/40 placeholder:text-slate-600" 
            />
          </div>
          
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">HTTP Method</label>
            <select 
              value={method} 
              onChange={(e) => setMethod(e.target.value)} 
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 font-mono text-xs text-slate-200 outline-none transition focus:border-cyan-500/40 appearance-none"
            >
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="GET">GET</option>
              <option value="PATCH">PATCH</option>
            </select>
          </div>
          
          {/* Advanced (Headers) Section with Paywall */}
          <div className="relative pt-2 pb-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-2 flex items-center gap-1.5">
              Advanced (Headers)
              {isAdvancedLocked && <Lock className="h-3 w-3 text-amber-500" />}
            </label>
            
            <div className={`space-y-2 ${isAdvancedLocked ? 'blur-[2.5px] opacity-60 pointer-events-none select-none' : ''}`}>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Key (e.g. Authorization)" 
                  className="w-1/2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-slate-200 outline-none placeholder:text-slate-600" 
                  disabled={isAdvancedLocked} 
                />
                <input 
                  type="text" 
                  placeholder="Value" 
                  className="w-1/2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-slate-200 outline-none placeholder:text-slate-600" 
                  disabled={isAdvancedLocked} 
                />
              </div>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Key" 
                  className="w-1/2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-slate-200 outline-none placeholder:text-slate-600" 
                  disabled={isAdvancedLocked} 
                />
                <input 
                  type="text" 
                  placeholder="Value" 
                  className="w-1/2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-slate-200 outline-none placeholder:text-slate-600" 
                  disabled={isAdvancedLocked} 
                />
              </div>
            </div>
            
            {/* Paywall Overlay */}
            {isAdvancedLocked && (
              <div 
                className="absolute inset-0 z-10 flex items-center justify-center cursor-pointer pt-6"
                onClick={() => setUpgradeModal({ isOpen: true, feature: 'Custom Header Injection', tier: 'Pro or higher' })}
              >
                <div className="bg-slate-900/90 px-4 py-2 rounded-full border border-amber-500/30 flex items-center gap-2 text-xs font-semibold text-amber-400 shadow-xl shadow-amber-900/20 hover:scale-105 transition-transform duration-200">
                  <Lock className="h-3.5 w-3.5" /> Unlock Pro Feature
                </div>
              </div>
            )}
          </div>

          <button 
            onClick={handleSave} 
            disabled={saving || !targetUrl} 
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 py-3 text-xs font-bold text-cyan-400 hover:bg-cyan-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-4"
          >
            {saving ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...</>
            ) : (
              <><Save className="h-3.5 w-3.5" /> Save Configuration</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
