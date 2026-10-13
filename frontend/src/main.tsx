import '@fontsource-variable/inter';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth';
import { ToastProvider } from './toast';
import { CartProvider } from './cart';
import App from './App';
import './index.css';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <AuthProvider><ToastProvider><CartProvider><App /></CartProvider></ToastProvider></AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
