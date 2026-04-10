import { useEffect, useMemo, useRef, useState } from 'react';
import './Renderer.css';

function getPickedLabelFromEvent(event) {
  // X3DOM sends a regular DOM event with a target somewhere in the X3D DOM.
  // Try to find something stable: id / DEF / def (case-insensitive in HTML).
  const candidates = [];

  // 1) Best-effort: X3DOM pick info often includes a hit object that points back to the XML node.
  // Different X3DOM builds expose slightly different shapes, so probe a few common locations.
  const maybeHitObjects = [
    event?.hitObject,
    event?.pickedObject,
    event?.hitElement,
    event?.detail?.hitObject,
    event?.detail?.pickedObject,
    event?.detail?.hitElement,
    event?.detail,
  ].filter(Boolean);

  for (const hit of maybeHitObjects) {
    const xmlNode = hit?._xmlNode || hit?.xmlNode || hit?.node || hit?.target;
    if (xmlNode && xmlNode.nodeType === 1) {
      candidates.push(xmlNode);
    }
  }

  // 2) Always include the DOM event target as a fallback.
  if (event?.target) candidates.push(event.target);

  const uniqueCandidates = Array.from(new Set(candidates));
  let node = uniqueCandidates[0];
  const visited = new Set();

  while (node && node !== document && !visited.has(node)) {
    visited.add(node);

    const pickLabel = node.getAttribute?.('data-pick-label');
    if (pickLabel) return pickLabel;

    const id = node.getAttribute?.('id');
    if (id) return id;

    const def = node.getAttribute?.('DEF') || node.getAttribute?.('def');
    if (def) return def;

    node = node.parentNode;
  }

  // If we didn't resolve from the first candidate, try remaining candidates.
  for (let i = 1; i < uniqueCandidates.length; i += 1) {
    node = uniqueCandidates[i];
    const localVisited = new Set();

    while (node && node !== document && !localVisited.has(node)) {
      localVisited.add(node);

      const pickLabel = node.getAttribute?.('data-pick-label');
      if (pickLabel) return pickLabel;

      const id = node.getAttribute?.('id');
      if (id) return id;

      const def = node.getAttribute?.('DEF') || node.getAttribute?.('def');
      if (def) return def;

      node = node.parentNode;
    }
  }

  return event?.target?.nodeName || '—';
}

function attachX3domInlinePickHandlers(rootEl) {
  if (!rootEl) return;

  const nodes = rootEl.querySelectorAll('[data-pick-label]');
  nodes.forEach((node) => {
    const label = node.getAttribute('data-pick-label');
    if (!label) return;

    // X3DOM expects attribute strings like plain HTML: onclick="fn('id')".
    // We set them after mount so React doesn't sanitize/remove them.
    const jsLabel = JSON.stringify(label);
    const clickCode = `window.__gnfPick && window.__gnfPick(${jsLabel})`;

    if (node.getAttribute('onclick') !== clickCode) {
      node.setAttribute('onclick', clickCode);
    }
  });
}


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
export default function X3DViewer({ assetPath = 'fish-tank.x3d', children, onPicked, ...props }) {
  const [ready, setReady] = useState(!!window.x3dom);
  const x3dRef = useRef(null);

  const stableOnPicked = useMemo(() => onPicked, [onPicked]);

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

  useEffect(() => {
    if (!ready) return;
    const el = x3dRef.current;
    if (!el) return;

    let cancelled = false;
    let attempts = 0;

    const tick = () => {
      if (cancelled) return;
      attachX3domInlinePickHandlers(el);

      // Retry a bit because X3DOM processes the scene asynchronously.
      if (attempts < 20) {
        attempts += 1;
        setTimeout(tick, 100);
      }
    };

    tick();
    return () => {
      cancelled = true;
    };
  }, [ready, assetPath, children]);

  useEffect(() => {
    if (!ready) return;
    const el = x3dRef.current;
    if (!el) return;
    if (!stableOnPicked) return;

    const handler = (event) => {
      const label = getPickedLabelFromEvent(event);
      stableOnPicked({ label, event });
    };

    // Use a native listener so we can access X3DOM-specific event fields.
    el.addEventListener('click', handler);
    return () => {
      el.removeEventListener('click', handler);
    };
  }, [ready, stableOnPicked]);

  if (!ready) {
    return <div className="renderer-loading">Loading 3D…</div>;
  }

  return (
    <x3d
      ref={x3dRef}
      className="renderer-x3d-full"
      showstat="false"
      showlog="false"
      {...props}
    >
      <scene>
        <background skycolor="0.85 1 0.92" />
        <inline url={`"${assetPath}"`} />
        {children}
      </scene>
    </x3d>
  );
}
