import { Component, type ErrorInfo, type ReactNode } from 'react';
import { showBootError } from './bootDiagnostics';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Converts any swallowed render crash into VISIBLE text over the green felt
 * background. Without this, a throw in AppRoot/children leaves a blank screen.
 */
export class BootErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    showBootError('React render error', `${error.message}\n\n${info.componentStack ?? ''}`);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <main
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 14,
            padding: 24,
            textAlign: 'center',
            color: '#f4f4f4',
            background: '#0b1f17',
            font: '14px/1.5 ui-monospace, Menlo, Consolas, monospace',
          }}
        >
          <h2 style={{ margin: 0 }}>Something went wrong starting the app</h2>
          <pre style={{ maxWidth: '90vw', overflow: 'auto', whiteSpace: 'pre-wrap' }}>
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              fontSize: 16,
              border: 0,
              borderRadius: 8,
              background: '#f5c518',
              color: '#1a1a1a',
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}
