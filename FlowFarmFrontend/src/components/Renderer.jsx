import React, { useEffect } from "react";


// 3D Model Renderer. Modify in future to load 3D models based on game state.
function Render3D() {
  if (!window.x3dom) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://www.x3dom.org/release/x3dom.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://www.x3dom.org/release/x3dom.js";
    document.head.appendChild(script);
  }
}

export default function Renderer() {
  useEffect(() => {
    Render3D();
  }, []);

  return (
    <div style={{ margin: "1rem" }}>
      <x3d width="1000px" height="250px" navigationType="NONE">
        
        <scene>
          <inline url="fishtank.x3d" />
        </scene>
      </x3d>
    </div>
  );
}