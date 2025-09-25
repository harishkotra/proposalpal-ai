import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MeshProvider } from '@meshsdk/react';
import { CreditsProvider } from './context/CreditsContext'; // 1. Import
import '@meshsdk/react/styles.css';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <MeshProvider>
        <CreditsProvider> {/* 2. Wrap App */}
          <App />
        </CreditsProvider>
      </MeshProvider>
    </BrowserRouter>
  </React.StrictMode>
);