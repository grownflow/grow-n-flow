import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Suppress React's "unrecognized tag" warnings for valid X3D elements.
// React's DOM reconciler doesn't know about X3D; X3DOM processes these nodes correctly at runtime.
// The warning fires as console.error(formatString, tagName) in dev builds only.
if (import.meta.env.DEV) {
  const X3D_TAGS = new Set([
    'x3d', 'scene', 'background', 'inline', 'viewpoint', 'transform',
    'shape', 'appearance', 'material', 'group',
  ]);
  const _origError = console.error.bind(console);
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('is unrecognized in this browser') &&
      X3D_TAGS.has(String(args[1] ?? '').toLowerCase())
    ) {
      return;
    }
    _origError(...args);
  };
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
