import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// Entrance animations only hide content when script is running.
document.documentElement.classList.add('js');

createRoot(document.getElementById('root')).render(<App />);
