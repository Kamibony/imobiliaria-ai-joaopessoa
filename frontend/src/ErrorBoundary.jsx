import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div className="error-fallback"><h3>⚠️ Dados Indisponíveis</h3><p>Houve um erro ao renderizar as informações deste imóvel.</p></div>;
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
