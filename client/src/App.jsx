import { useState, useRef, useEffect } from 'react';
import Canvas from './Canva.jsx';
import socket from './socket.js';
import './app.css';
import HamburgerMenu from './HamburgerMenu.jsx';
import Drawbar from './Drawbar.jsx';
import Textbox from './Textbox.jsx';
import Toolbar from './Toolbar.jsx';

export default function App() {
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(2);
  const [tool, setTool] = useState("draw");
  const [texts, setTexts] = useState([]);
  const [editingText, setEditingText] = useState(null);
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
        <div className="canvas-container">
          <Canvas ref={canvasRef} tool={tool} color={color} brushSize={brushSize} texts={texts} setEditingText={setEditingText} />
          {tool === "text" && editingText && (
            <Textbox texts={texts} setTexts={setTexts} editingText={editingText} setEditingText={setEditingText} />
          )}
        </div>
      </div>
    </div>
  );
}