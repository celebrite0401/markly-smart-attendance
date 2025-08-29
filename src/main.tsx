import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Optional: run lightweight dev tests without altering providers
if (import.meta.env.DEV) {
  import('./utils/testSuite').then(({ runMarklyTests }) => {
    setTimeout(() => runMarklyTests().catch(console.error), 3000);
  }).catch(() => {});
}

createRoot(document.getElementById('root')!).render(
  <App />
);
