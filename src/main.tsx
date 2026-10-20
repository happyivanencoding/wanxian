import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './styles.css';
import './pixel-theme.css';
document.documentElement.dataset.design = 'pixel';
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
