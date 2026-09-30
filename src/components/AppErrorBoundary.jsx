import { Component } from 'react';

const shell = {
  minHeight: '100%',
  display: 'grid',
  placeItems: 'center',
  padding: '2rem',
  background: '#06080d',
  color: '#f3f6fa',
  fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
  textAlign: 'center',
};

/**
 * React normally clears the root after an uncaught render error, which looks
 * exactly like a failed screen on a kiosk. Keep a useful, dark diagnostic on
 * the panel instead. This boundary does not attempt an automatic retry loop;
 * Chromium's launcher is the process-level recovery mechanism.
 */
class AppErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[fatal] Home Interface render failed', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main style={shell}>
        <div>
          <h1 style={{ margin: '0 0 0.75rem', fontSize: '2rem' }}>
            Home Interface stopped
          </h1>
          <p style={{ margin: 0, color: '#93a1b5', fontSize: '1rem' }}>
            The display is working, but the app hit a startup error.
          </p>
          <p style={{ margin: '1rem 0 0', color: '#35b6ff', fontSize: '0.875rem' }}>
            Reboot the panel, then check the kiosk and Vite logs.
          </p>
        </div>
      </main>
    );
  }
}

export default AppErrorBoundary;
