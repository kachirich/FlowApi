import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';

/**
 * DocsLayout — shared chrome for every public docs page.
 * Sticky top nav, centered content area, and a small footer.
 */
export default function DocsLayout({ children }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-indigo-500/30 flex flex-col">
      {/* Sticky nav */}
      <nav className="sticky top-0 z-50 w-full border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">FlowGateway</span>
          </Link>
          <div className="flex items-center gap-5">
            <Link
              to="/docs"
              className="text-sm font-medium text-zinc-400 hover:text-white transition-colors"
            >
              Integrations
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium bg-zinc-100 text-zinc-900 rounded-md hover:bg-white transition-colors"
            >
              Dashboard →
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-6 py-12 md:py-16">
        {children}
      </main>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-zinc-900 text-center text-zinc-500 text-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-2">
          <Zap className="w-4 h-4 text-zinc-600" />
          <span>FlowGateway © 2026</span>
          <span className="text-zinc-700">·</span>
          <Link to="/" className="hover:text-zinc-300 transition-colors">Home</Link>
        </div>
      </footer>
    </div>
  );
}
