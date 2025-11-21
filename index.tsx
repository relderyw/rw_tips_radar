import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Verificação de login ao acessar o projeto
if (typeof window !== 'undefined') {
  try {
    if (sessionStorage.getItem('loggedIn') !== 'true') {
      window.location.href = 'https://rw-tips.netlify.app/index?error=login_required';
    }
  } catch (e) {
    // Caso sessionStorage não esteja disponível, não bloquear
    console.warn('Login check skipped:', e);
  }
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);