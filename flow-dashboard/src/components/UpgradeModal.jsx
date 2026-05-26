import React from 'react';
import { Lock, X } from 'lucide-react';

export default function UpgradeModal({ isOpen, onClose, featureName, requiredTier, onNavigateToPricing }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl border border-amber-500/30 bg-surface-raised/95 p-8 shadow-[0_0_40px_-10px_rgba(245,158,11,0.3)] backdrop-blur-md animate-in zoom-in-95 duration-200 overflow-hidden">
        
        {/* Subtle Animated Glow Effect */}
        <div className="absolute -inset-[100%] z-0 animate-[spin_10s_linear_infinite] opacity-20 pointer-events-none" 
             style={{ background: 'conic-gradient(from 90deg at 50% 50%, #0f172a 0%, #f59e0b 50%, #0f172a 100%)' }} 
        />
        <div className="absolute inset-0 z-0 bg-surface-raised/90 backdrop-blur-3xl pointer-events-none" />

        <div className="relative z-10">
          {/* Close Button */}
          <button 
            onClick={onClose}
            className="absolute -top-2 -right-2 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Icon & Title */}
          <div className="flex items-center gap-3 mb-4 text-amber-400">
            <h2 className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-amber-200 to-amber-400 tracking-wide">
              ✨ Premium Tool Discovered
            </h2>
          </div>

          {/* Message */}
          <p className="text-slate-300 text-sm mb-8 leading-relaxed">
            The <strong className="font-bold text-white">{featureName}</strong> engine is a high-performance feature reserved for our <strong className="font-bold text-amber-400">{requiredTier}</strong> architects. Upgrade your workspace to unlock this and scale your infrastructure.
          </p>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-700 bg-slate-800/40 py-2.5 text-sm font-semibold text-slate-350 hover:bg-slate-800 hover:text-white transition-all duration-200"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onClose();
                if (onNavigateToPricing) {
                  onNavigateToPricing();
                }
              }}
              className="flex-1 rounded-lg bg-gradient-to-r from-amber-400 via-amber-350 to-yellow-400 py-2.5 text-sm font-bold text-slate-950 hover:brightness-110 shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all duration-200"
            >
              Unlock {requiredTier}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
