import { useState, useRef, useEffect } from 'react';
import Canvas from './Canva.jsx';
import socket from './socket.js';
import './App.css';
import HamburgerMenu from './HamburgerMenu.jsx';

export default function App() {
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(2);
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
      <div className="toolbar">
        <div className="tool-group">
          <label>Color:</label>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
        </div>
        <div className="tool-group">
          <label>Brush Size:</label>
          <input
            type="range"
            min="1"
            max="20"
            value={brushSize}
            onChange={(e) => setBrushSize(e.target.value)}
          />
          <span>{brushSize}px</span>
        </div>
        <button onClick={handleClear} className="clear-btn">Clear Canvas</button>
      </div>
      <div className="canvas-container">
        <Canvas ref={canvasRef} color={color} brushSize={brushSize} />
      </div>
    </div>
  );
}