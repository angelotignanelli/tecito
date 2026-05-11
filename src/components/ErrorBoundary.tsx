import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Optional label for telemetry / debugging — gets prepended to the
   * console message so we can tell which boundary captured. */
  label?: string
}

interface State {
  error: Error | null
  info: ErrorInfo | null
}

/**
 * Last-line-of-defence error boundary. When any descendant throws
 * during render / lifecycle, React unmounts the whole tree and
 * normally we'd see a blank page. The boundary catches the error,
 * surfaces it in the UI, and lets the user copy the message + reload.
 *
 * Deliberately verbose: keeping the error visible (instead of a
 * "something went wrong" toast) is the whole point — we want the
 * stack trace reachable from a phone without needing to plug it into
 * a Mac to read DevTools.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface to console so devtools (when reachable) get the full
    // React component stack on top of the JS error.
    console.error(`[ErrorBoundary${this.props.label ? ` · ${this.props.label}` : ''}]`, error, info)
    this.setState({ info })
  }

  reset = () => this.setState({ error: null, info: null })

  render() {
    const { error, info } = this.state
    if (!error) return this.props.children
    return (
      <div className="min-h-screen bg-bg p-6 flex items-center justify-center">
        <div className="w-full max-w-[560px] bg-surface border border-coral-light rounded-[14px] p-6">
          <div className="text-[10px] text-coral uppercase tracking-[0.12em] mb-2" style={{ fontFamily: 'var(--font-mono)' }}>
            Algo se rompió
          </div>
          <h1 className="text-[24px] tracking-[-0.02em] text-text m-0 mb-4" style={{ fontFamily: 'var(--font-serif)' }}>
            Error en la app.
          </h1>
          <pre className="text-[12px] text-coral bg-coral-light rounded-[8px] p-3 whitespace-pre-wrap break-words mb-4 max-h-[200px] overflow-auto" style={{ fontFamily: 'var(--font-mono)' }}>
            {error.message}
            {error.stack ? `\n\n${error.stack}` : ''}
          </pre>
          {info?.componentStack && (
            <details className="text-[11px] text-text-hint mb-4">
              <summary className="cursor-pointer">Stack de componentes</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words" style={{ fontFamily: 'var(--font-mono)' }}>
                {info.componentStack}
              </pre>
            </details>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={this.reset}
              className="flex-1 px-4 py-2.5 rounded-[10px] text-[13px] font-medium border border-gray-border-2 bg-surface text-text hover:bg-surface-2 cursor-pointer transition-colors"
            >
              Reintentar
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex-1 px-4 py-2.5 rounded-[10px] text-[13px] font-medium bg-primary text-surface hover:bg-[#2F3C2D] cursor-pointer transition-colors"
            >
              Recargar página
            </button>
          </div>
        </div>
      </div>
    )
  }
}
