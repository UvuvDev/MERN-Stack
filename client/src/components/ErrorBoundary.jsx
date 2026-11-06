import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    // Keep the fallback friendly; the browser console is enough in development.
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="crash">
          <div className="crash__card">
            <p className="eyebrow">Unexpected error</p>
            <h1>Something went wrong.</h1>
            <p>
              The page could not be rendered. Your saved comparisons are safe. Try reloading, or return to
              the comparison builder.
            </p>
            <div className="crash__actions">
              <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
                Reload the page
              </button>
              <a className="btn btn--outline" href="/">
                Back to the comparison builder
              </a>
            </div>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
