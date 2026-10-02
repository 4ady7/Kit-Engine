import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  message: string | null;
}

export class ViewportErrorBoundary extends Component<Props, State> {
  state: State = { message: null };

  static getDerivedStateFromError(error: Error): State {
    return { message: error.message };
  }

  render() {
    if (this.state.message) {
      return (
        <div className="flex h-full min-h-[320px] items-center justify-center bg-studio px-6 text-center text-[13px]">
          The 3D view could not start. {this.state.message}
        </div>
      );
    }
    return this.props.children;
  }
}
