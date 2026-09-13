import { Component, type ReactNode } from "react";

export class AppErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main>
        <h1>FreeLP could not display this page</h1>
        <p>
          Reload the application to restore the interface. A request already
          submitted to your wallet may still be pending; check its activity
          before repeating it.
        </p>
        <button onClick={() => window.location.reload()}>Reload FreeLP</button>
      </main>
    );
  }
}
