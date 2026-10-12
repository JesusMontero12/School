import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/academic.css';
import App from './app/App';

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
