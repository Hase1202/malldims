import { Component, ErrorInfo, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-6">
              <div className="text-center">
                <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h1 className="text-xl font-bold text-gray-900 mb-2">
                  Unexpected Application Error!
                </h1>
                <p className="text-gray-600 mb-4">
                  {this.state.error?.message || '404 Not Found'}
                </p>
                <div className="text-sm text-gray-500 mb-6 py-2 px-3 bg-gray-100 rounded-md">
                  <p>👋 Hey developer 👋</p>
                  <p className="mt-1">
                    You can provide a way better UX than this when your app throws errors by providing your own{" "}
                    <code className="text-primary font-mono">ErrorBoundary</code> or{" "}
                    <code className="text-primary font-mono">errorElement</code> prop on your route.
                  </p>
                </div>
                <Link 
                  to="/"
                  className="block w-full py-2 px-4 bg-primary hover:bg-primary-dark text-white font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                >
                  Return to Home
                </Link>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 