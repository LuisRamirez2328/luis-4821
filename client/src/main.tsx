/**
 * Punto de entrada del cliente.
 *
 * Monta la aplicacion y expone el AuthProvider como ancestro de todo el
 * arbol, para que el estado de sesion este disponible en cualquier pagina.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { AuthProvider } from './context/AuthContext';
import './styles/global.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('No se encontro el elemento #root en index.html');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
);
