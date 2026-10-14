import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from './Buttons'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Catches render errors in a screen and shows a recoverable message instead of
 * unmounting the whole app (which would leave a blank screen). The nav bar sits
 * outside this boundary, so navigation keeps working after a failure.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Antra screen error:', error, info.componentStack)
  }

  private reset = () => this.setState({ error: null })

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="scroll-y h-full">
        <div className="flex min-h-full flex-col items-center justify-center gap-3 px-8 py-16 text-center">
          <div className="text-[40px]" aria-hidden>
            😕
          </div>
          <h2 className="text-[18px] font-semibold text-ink">Something went wrong</h2>
          <p className="max-w-[280px] text-[13px] text-muted">
            This screen hit an unexpected error. Your data is safe — try again, or reload the app.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Button variant="secondary" onClick={this.reset}>
              Try again
            </Button>
            <Button onClick={() => window.location.reload()}>Reload</Button>
          </div>
        </div>
      </div>
    )
  }
}
