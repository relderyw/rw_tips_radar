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
    const isLogged = sessionStorage.getItem('loggedIn') === 'true' || localStorage.getItem('rw_user_auth') === '1';
    const params = new URLSearchParams(window.location.search || '');
    const hasLoginError = params.get('error') === 'login_required';
    if (!isLogged && !hasLoginError) {
      // Redireciona dentro da mesma origem para evitar cross-origin e manter o hash
      const base = window.location.pathname || '/index.html';
      const hash = window.location.hash || '';
      window.location.replace(`${base}?error=login_required${hash}`);
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