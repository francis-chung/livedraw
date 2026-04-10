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
  const [tool, setTool] = useState('draw');
  const [objects, setObjects] = useState([]);
  const [editingText, setEditingText] = useState(null);
  const [selectedObjectId, setSelectedObjectId] = useState(null);
  const canvasRef = useRef();

  // clear screen function
  const handleClear = () => {
    canvasRef.current.clear();
    setObjects([]);
    setSelectedObjectId(null);
    socket.emit('clear');
  };

  useEffect(() => {
    // removes preload class to reenable transitions after initial loading    
    document.body.classList.remove('preload');

    // waits for server updates, then sends changes to canvas
    socket.on('loadState', ({ objects: serverObjects }) => {
      setObjects(serverObjects || []);
    });

    socket.on('startStroke', (stroke) => {
      setObjects((prev) => [...prev, stroke]);
    });

    // appends point data to the correct object in object array
    socket.on('appendStroke', ({ id, point }) => {
      setObjects((prev) => prev.map((obj) =>
        obj.id === id && obj.type === 'stroke'
          ? { ...obj, points: [...obj.points, point] }
          : obj
      ));
    });

    socket.on('addObject', (object) => {
      setObjects((prev) => [...prev, object]);
    });

    socket.on('clear', () => {
      setObjects([]);
      setSelectedObjectId(null);
    });

    return () => {
      socket.off('loadState');
      socket.off('startStroke');
      socket.off('appendStroke');
      socket.off('addObject');
      socket.off('clear');
    };
  }, [setObjects, setSelectedObjectId]);

  return (
    <div className="app">
      <header className="header">
        <h1>Livedraw</h1>
        <HamburgerMenu />
      </header>
      {tool === 'draw' && (
        <Drawbar
          color={color}
          setColor={setColor}
          brushSize={brushSize}
          setBrushSize={setBrushSize}
          handleClear={handleClear}
        />
      )}
      <div className="canvas-tools">
        <Toolbar tool={tool} setTool={setTool} />
        <div className="canvas-container">
          <Canvas
            ref={canvasRef}
            tool={tool}
            color={color}
            brushSize={brushSize}
            objects={objects}
            setObjects={setObjects}
            selectedObjectId={selectedObjectId}
            setSelectedObjectId={setSelectedObjectId}
            setEditingText={setEditingText}
          />
          {tool === 'text' && editingText && (
            <Textbox
              objects={objects}
              setObjects={setObjects}
              editingText={editingText}
              setEditingText={setEditingText}
            />
          )}
        </div>
      </div>
    </div>
  );
}