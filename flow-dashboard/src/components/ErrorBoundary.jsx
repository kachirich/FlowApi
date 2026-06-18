import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 font-sans text-slate-200">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/20 bg-slate-900/50 p-8 shadow-2xl backdrop-blur-xl text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/10 mb-6">
              <AlertTriangle className="h-8 w-8 text-rose-500" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-sm text-slate-400 mb-8 leading-relaxed">
              We encountered an unexpected error while rendering this page. 
              {this.state.error && <span className="block mt-2 font-mono text-[10px] text-rose-400 bg-rose-950/30 p-2 rounded text-left overflow-auto">{this.state.error.toString()}</span>}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-rose-500 hover:shadow-lg hover:shadow-rose-500/20"
            >
              <RefreshCw className="h-4 w-4" />
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
