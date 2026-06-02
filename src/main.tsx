import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app';
import { KnowledgeStoreProvider } from './store';
import './index.css';
import 'katex/dist/katex.min.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <KnowledgeStoreProvider>
    <App />
  </KnowledgeStoreProvider>
);
