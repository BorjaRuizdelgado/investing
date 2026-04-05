import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', {
      component: this.props.name || 'unknown',
      error: error?.message,
      stack: error?.stack,
      componentStack: info?.componentStack,
    })
  }

  handleRetry = () => {
    this.setState({ hasError: false })
  }

  render() {
    if (this.state.hasError) {
      const section = this.props.name || 'this section'
      return (
        <div className="error-boundary-fallback">
          <p className="error-boundary-fallback__msg">
            We couldn't load {section}. This is usually a temporary issue — try again or switch to another tab.
          </p>
          <button className="error-boundary-fallback__btn" onClick={this.handleRetry}>
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
