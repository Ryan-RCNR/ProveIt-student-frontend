import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('React error boundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-midnight flex items-center justify-center p-4">
          <div className="glass rounded-xl p-8 max-w-md text-center">
            <h1 className="text-2xl font-display text-ice mb-4">Something went wrong</h1>
            <p className="text-gray-400 mb-6">
              Please refresh the page and try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-ice text-deep-sea font-semibold rounded-lg hover:bg-ice-muted transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
