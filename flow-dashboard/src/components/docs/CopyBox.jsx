import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * CopyBox — labelled, copy-to-clipboard value panel.
 *
 * Props:
 *   label  - muted text shown above the value
 *   value  - the string to display and copy
 *   mono   - render the value in JetBrains Mono (default true)
 */
export default function CopyBox({ label, value, mono = true }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success('Copied');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 shadow-[0_0_30px_-15px_rgba(99,102,241,0.25)]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />
      {label && (
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          {label}
        </p>
      )}
      <div className="flex items-start justify-between gap-3">
        <code
          className={`min-w-0 flex-1 break-all whitespace-pre-wrap text-sm text-zinc-200 ${
            mono ? 'font-mono' : 'font-sans'
          }`}
        >
          {value}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          title="Copy to clipboard"
          className="flex shrink-0 items-center justify-center rounded-md border border-zinc-700/60 bg-zinc-900 p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
