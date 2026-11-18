import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ShalomErrorPage } from './components/common/ShalomErrorPage.tsx';
import { classifyAppError } from './services/studios/canvasSafety.ts';
import './index.css';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage?: string;
  errorMode?: 'offline' | 'network' | 'runtime';
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const mode = classifyAppError(error);
    const msg = error instanceof Error ? error.message : String(error || '');
    return {
      hasError: true,
      errorMode: mode,
      errorMessage: msg ? msg.slice(0, 180) : undefined,
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <ShalomErrorPage
          mode={this.state.errorMode || 'runtime'}
          technicalHint={this.state.errorMessage}
          onRetry={() => {
            this.setState({ hasError: false, errorMessage: undefined });
            window.location.reload();
          }}
        />
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
