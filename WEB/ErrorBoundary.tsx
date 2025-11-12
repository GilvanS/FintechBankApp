import React from 'react';

type ErrorBoundaryState = {
  hasError: boolean;
  error?: Error;
  info?: React.ErrorInfo;
};

export default class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Runtime error capturado pelo ErrorBoundary:', error, info);
    this.setState({ info });
  }

  handleReload = () => {
    // Recarrega a aplicação; se estava em um estado ruim, volta a funcionar
    location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 bg-black/90 text-white p-6 overflow-auto">
          <h1 className="text-2xl font-bold mb-2">Erro em tempo de execucao</h1>
          <p className="mb-4">Um erro interrompeu a renderizacao. Veja os detalhes abaixo:</p>
          <pre className="bg-white/10 p-4 rounded mb-4 whitespace-pre-wrap">
            {this.state.error?.message}
            {'\n'}
            {this.state.error?.stack}
            {'\n'}
            {this.state.info?.componentStack}
          </pre>
          <button onClick={this.handleReload} className="px-4 py-2 bg-primary text-black rounded">
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}