import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryState {
  hasError: boolean;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#f7f8fa] dark:bg-[#060d1d] text-slate-900 dark:text-white p-6 text-center">
          <div className="max-w-sm space-y-4">
            <h1 className="text-xl font-bold font-display">SHALOM</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Une erreur d’affichage s’est produite. Rechargez la page pour restaurer votre espace.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold"
            >
              Recharger SHALOM
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

(window as unknown as { __SHALOM_BOOTED__?: boolean }).__SHALOM_BOOTED__ = true;

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
