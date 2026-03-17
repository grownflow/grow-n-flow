import { useEffect, useState } from 'react';
import './Renderer.css';

// Shared X3DOM loader to avoid multiple CDN calls
function ensureX3DOMLoaded() {
  if (window.x3dom) return Promise.resolve();

  if (!window.__x3domLoadingPromise) {
    window.__x3domLoadingPromise = new Promise((resolve, reject) => {
      const existingCss = document.querySelector('link[data-x3dom="true"]');
      if (!existingCss) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://www.x3dom.org/release/x3dom.css";
        link.setAttribute('data-x3dom', 'true');
        document.head.appendChild(link);
      }

      const existingScript = document.querySelector('script[data-x3dom="true"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve());
        existingScript.addEventListener('error', () => reject(new Error('Failed to load X3DOM')));
        return;
      }

      const script = document.createElement("script");
      script.src = "https://www.x3dom.org/release/x3dom.js";
      script.async = true;
      script.setAttribute('data-x3dom', 'true');
      script.addEventListener('load', () => resolve());
      script.addEventListener('error', () => reject(new Error('Failed to load X3DOM')));
      document.head.appendChild(script);
    });
  }

  return window.__x3domLoadingPromise;
}

/**
 * Reusable X3D scene viewer component.
 * Loads any X3D file and renders it using X3DOM.
 * Modularity allows easy swapping of different 3D assets.
 * 
 * @param {string} assetPath - Path to X3D file (e.g., 'fish-tank.x3d', 'grow-bed.x3d')
 * @param {object} props - Additional props to pass to the wrapper div
 */
export default function X3DViewer({ assetPath = 'fish-tank.x3d', children, ...props }) {
  const [ready, setReady] = useState(!!window.x3dom);

  useEffect(() => {
    let cancelled = false;

    ensureX3DOMLoaded()
      .then(() => {
        if (cancelled) return;
        setReady(true);
        try {
          window.x3dom?.reload?.();
        } catch {
          // ignore
        }
      })
      .catch(() => {
        if (cancelled) return;
        setReady(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return <div className="renderer-loading">Loading 3D…</div>;
  }

  return (
    <x3d className="renderer-x3d-full" showStat="false" {...props}>
      <scene>
        <background skyColor="0.85 1 0.92" />
        <inline url={`"${assetPath}"`} />
        {children}
      </scene>
    </x3d>
  );
}
