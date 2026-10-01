import React from 'react';
import { HiOutlineExclamationCircle } from 'react-icons/hi';
import { MdCloudOff } from 'react-icons/md';
import toast from 'react-hot-toast';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, isRetrying: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  isOfflineChunkError(error) {
    if (!error) return false;
    const msg = error.message?.toLowerCase() || '';
    const isChunkError = msg.includes('fetch dynamically imported module') ||
      msg.includes('importing a module script failed') ||
      msg.includes('dynamically imported module');
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    return isOffline && isChunkError;
  }

  handleRetry = () => {
    this.setState({ isRetrying: true });
    window.location.reload();
  };

  componentDidCatch(error, errorInfo) {
    if (!this.isOfflineChunkError(error)) {
      toast.error('An unexpected error occurred in the UI.');
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.isOfflineChunkError(this.state.error)) {
        return (
          <div className="min-h-[400px] flex items-center justify-center p-6">
            <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-md w-full text-center shadow-sm">
              <MdCloudOff className="w-14 h-14 text-slate-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-2">You're offline</h2>
              <p className="text-slate-500 text-base font-medium mb-6">
                Please check your connection and try again.
              </p>
              <button
                onClick={this.handleRetry}
                disabled={this.state.isRetrying}
                className="btn-primary w-full text-base font-semibold py-2.5 flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {this.state.isRetrying ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Retrying...
                  </>
                ) : (
                  'Retry'
                )}
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="bg-white border border-red-200 rounded-xl p-8 max-w-md w-full text-center shadow-sm">
            <HiOutlineExclamationCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-base font-semibold text-slate-900 mb-2">Something went wrong</h2>
            <p className="text-slate-600 text-sm mb-6">
              An unexpected error occurred while loading this section. Our team has been notified.
            </p>
            <button
              onClick={this.handleRetry}
              disabled={this.state.isRetrying}
              className="btn-primary w-full text-sm flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {this.state.isRetrying ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Refreshing...
                </>
              ) : (
                'Refresh Page'
              )}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

