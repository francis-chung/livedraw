import { useState, useRef, useEffect } from 'react';
import Canvas from './Canva.jsx';
import socket from './socket.js';
import './App.css';
import HamburgerMenu from './HamburgerMenu.jsx';
import Drawbar from './Drawbar.jsx';
import Toolbar from './Toolbar.jsx';

export default function App() {
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(2);
  const [tool, setTool] = useState("draw");
  const canvasRef = useRef();

  const handleClear = () => {
    canvasRef.current.clear();
    socket.emit('clear');
  };

  useEffect(() => {
    document.body.classList.remove("preload");
  }, []);

  return (
    <div className="app">
      <header className="header">
        <h1>Livedraw</h1>
        <HamburgerMenu />
      </header>
      {tool === "draw" && <Drawbar color={color} setColor={setColor} brushSize={brushSize} setBrushSize={setBrushSize} handleClear={handleClear} />}
      <div className="canvas-tools">
        <Toolbar tool={tool} setTool={setTool} />
        <Canvas ref={canvasRef} color={color} brushSize={brushSize} />
      </div>
    </div>
  );
}