import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="fixed inset-0 bg-[#0f172a] flex items-center justify-center p-6 text-center z-[9999]">
                    <div className="max-w-md w-full bg-white/5 border border-rose-500/20 rounded-[32px] p-8 backdrop-blur-xl">
                        <div className="w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <AlertCircle className="text-rose-500" size={32} />
                        </div>
                        <h1 className="text-white text-2xl font-bold mb-2">Oops, something went wrong</h1>
                        <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
                            The application encountered an unexpected error. Please try refreshing.
                        </p>

                        <button
                            onClick={() => window.location.reload()}
                            className="w-full py-4 bg-white text-[#0f172a] rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all active:scale-95"
                        >
                            <RefreshCcw size={18} />
                            Refresh Application
                        </button>

                        {process.env.NODE_ENV === 'development' && (
                            <div className="mt-8 pt-6 border-t border-white/5 text-left">
                                <p className="text-rose-400 text-[10px] font-mono leading-tight break-words">
                                    {this.state.error?.toString()}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
