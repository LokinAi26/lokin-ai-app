import { Component } from "react";
import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

// Route-level safety net: a render throw in any lazily-loaded page resolves
// into this actionable fallback instead of a blank screen. Errors are logged
// for engineering (never rendered — no error details reach the driver).
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary] screen render failed", error, info?.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black p-6">
        <div className="w-full max-w-sm rounded-3xl border border-primary/20 lokin-panel p-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
            <AlertTriangle className="h-7 w-7 text-primary" />
          </div>
          <h1 className="font-heading text-xl font-bold metal-text">Something went wrong on this screen</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/55">
            LOKIN hit a snag showing this page. Reload to pick up right where you left off.
          </p>
          <div className="mt-5 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
            >
              Reload
            </button>
            <Link
              to="/"
              className="inline-flex w-full items-center justify-center rounded-2xl border border-primary/30 px-5 py-2.5 text-sm font-bold text-primary"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }
}
