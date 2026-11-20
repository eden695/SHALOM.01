import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ShalomErrorPage } from './components/common/ShalomErrorPage.tsx';
import { classifyAppError } from './services/studios/canvasSafety.ts';
import { initConnectivityMonitor } from './services/connectivity.ts';
import '@fontsource/outfit/400.css';
import '@fontsource/outfit/500.css';
import '@fontsource/outfit/600.css';
import '@fontsource/outfit/700.css';
import '@fontsource/outfit/800.css';
import '@fontsource/plus-jakarta-sans/300.css';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/400-italic.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/600-italic.css';
import '@fontsource/plus-jakarta-sans/700.css';
import './index.css';

initConnectivityMonitor();

// Clean one-shot cache recovery parameter if present
if (typeof window !== 'undefined') {
  try {
    sessionStorage.removeItem('shalom_asset_recover');
    const url = new URL(window.location.href);
    if (url.searchParams.has('shalom_v')) {
      url.searchParams.delete('shalom_v');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
  } catch {
    // ignore URL/storage restriction
  }
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage?: string;
  errorMode?: 'offline' | 'network' | 'runtime';
  recoveryKey: number;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, recoveryKey: 0 };

  static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState> {
    const mode = classifyAppError(error);
    const msg = error instanceof Error ? error.message : String(error || '');
    return {
      hasError: true,
      errorMode: mode,
      errorMessage: msg ? msg.slice(0, 180) : undefined,
    };
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    console.error('[SHALOM AppErrorBoundary]', error, errorInfo);
  }

  handleReturnToShalom = () => {
    try {
      sessionStorage.removeItem('shalom_nav_stack_v1');
      localStorage.removeItem('shalom_nav_stack_persist_v1');
      window.history.replaceState({}, '', window.location.pathname || './');
    } catch {
      // ignore storage/history error
    }
    this.setState((prev) => ({
      hasError: false,
      errorMessage: undefined,
      errorMode: undefined,
      recoveryKey: prev.recoveryKey + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <ShalomErrorPage
          mode={this.state.errorMode || 'runtime'}
          technicalHint={this.state.errorMessage}
          onRetry={() => {
            this.setState((prev) => ({
              hasError: false,
              errorMessage: undefined,
              errorMode: undefined,
              recoveryKey: prev.recoveryKey + 1,
            }));
          }}
          onReturnHome={this.handleReturnToShalom}
        />
      );
    }
    return <React.Fragment key={this.state.recoveryKey}>{this.props.children}</React.Fragment>;
  }
}

(window as unknown as { __SHALOM_BOOTED__?: boolean }).__SHALOM_BOOTED__ = true;

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
