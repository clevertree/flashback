import React from 'react'

export interface ErrorBoundaryProps {
  name?: string
  children: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  info?: React.ErrorInfo
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
    this.handleReset = this.handleReset.bind(this)
    this.handleCopy = this.handleCopy.bind(this)
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log for diagnostics; avoid crashing the app
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', this.props.name || 'Component', error, info)
    this.setState({ info })
  }

  handleReset() {
    this.setState({ hasError: false, error: undefined, info: undefined })
  }

  async handleCopy() {
    const details = this.getDetails()
    try {
      await navigator.clipboard.writeText(details)
      // eslint-disable-next-line no-console
      console.log('Error details copied to clipboard.')
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Failed to copy error details', e)
    }
  }

  getDetails() {
    const { error, info } = this.state
    const name = this.props.name || 'Component'
    const lines = [
      `Error in ${name}`,
      error ? `Message: ${error.message}` : 'Message: <unknown>',
      error && error.stack ? `Stack:\n${error.stack}` : 'Stack: <none>',
      info && info.componentStack ? `Component stack:\n${info.componentStack}` : 'Component stack: <none>'
    ]
    return lines.join('\n')
  }

  render() {
    if (!this.state.hasError) return this.props.children as React.ReactElement
    const name = this.props.name || 'Component'
    const details = this.getDetails()

    return (
      <section role="alert" className="bg-red-900/40 border border-red-700 text-red-200 rounded p-4 my-2">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">Something went wrong in {name}</h3>
          <div className="flex gap-2">
            <button className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded" onClick={this.handleCopy}>Copy details</button>
            <button className="px-2 py-1 text-xs bg-blue-700 hover:bg-blue-600 rounded" onClick={this.handleReset}>Reset</button>
          </div>
        </div>
        <pre className="text-xs whitespace-pre-wrap max-h-72 overflow-auto">{details}</pre>
      </section>
    )
  }
}
