import { Component } from "react";
import { logLocatorEvent } from "@/lib/locatorLogger";

export default class SharedErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    logLocatorEvent("error_boundary", {
      feature: this.props.feature || "unknown",
      message: error?.message || "Unknown error",
      stack: info?.componentStack || "",
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.08] p-4 text-sm text-red-200">
          Something went wrong while loading this section.
        </div>
      );
    }
    return this.props.children;
  }
}
