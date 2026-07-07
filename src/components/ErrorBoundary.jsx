import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-obsidian flex items-center justify-center p-6">
          <div className="bg-onyx rounded-[24px] p-8 max-w-md w-full border border-red-500/20">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <h2 className="font-urbanist text-xl font-medium text-pure-white mb-2">
                Terjadi Kesalahan
              </h2>
              <p className="text-sm text-slate-mist leading-relaxed">
                Aplikasi mengalami error. Silahkan muat ulang halaman.
              </p>
              {this.state.error && (
                <p className="mt-3 text-xs text-red-400/70 font-mono bg-obsidian rounded-xl p-3 text-left break-all">
                  {this.state.error.message}
                </p>
              )}
            </div>
            <button
              onClick={this.handleReset}
              className="w-full py-3.5 px-8 bg-electric-violet text-pure-white font-medium text-sm rounded-full hover:brightness-110 active:brightness-90 transition-all"
            >
              Muat Ulang
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
