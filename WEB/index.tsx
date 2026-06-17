
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import ErrorBoundary from './ErrorBoundary';

console.log('🚀 index.tsx loaded');

const rootElement = document.getElementById('root');
console.log('📦 Root element:', rootElement);

if (!rootElement) {
  console.error('❌ Could not find root element');
  throw new Error("Could not find root element to mount to");
}

console.log('✅ Creating React root...');
const root = ReactDOM.createRoot(rootElement);

console.log('🎨 Rendering App...');
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter basename="/FintechBankApp">
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);

console.log('✨ React render called successfully');