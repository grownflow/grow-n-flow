import { useEffect, useRef } from "react";
import { initScene } from "./game/scene";

function App() {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (canvasRef.current) initScene(canvasRef.current);
  }, []);

  return <canvas ref={canvasRef} style={{ width: "100vw", height: "100vh" }} />;
}

export default App;
