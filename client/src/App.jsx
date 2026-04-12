import { useState, useRef, useEffect } from 'react';
import Canvas from './Canva.jsx';
import socket from './socket.js';
import './app.css';
import HamburgerMenu from './HamburgerMenu.jsx';
import Drawbar from './Drawbar.jsx';
import Selectbar from './Selectbar.jsx';
import Textbar from './Textbar.jsx';
import Textbox from './Textbox.jsx';
import Toolbar from './Toolbar.jsx';

export default function App() {
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(2);
  const [fontSize, setFontSize] = useState(16);
  const [textColor, setTextColor] = useState('#000000');
  const [tool, setTool] = useState('draw');
  const [objects, setObjects] = useState([]);
  const [editingText, setEditingText] = useState(null);
  const [selectedObjectId, setSelectedObjectId] = useState(null);
  const [interactingWithTextbar, setInteractingWithTextbar] = useState(false);
  const canvasRef = useRef();

  const handleClear = () => {
    canvasRef.current.clear();
    setObjects([]);
    setSelectedObjectId(null);
    socket.emit('clear');
  };

  const deleteObject = (objectId) => {
    setObjects((prev) => prev.filter(obj => obj.id !== objectId));
    setSelectedObjectId(null);
    socket.emit('deleteObject', objectId);
  }

  useEffect(() => {
    document.body.classList.remove('preload');

    socket.on('loadState', ({ objects: serverObjects }) => {
      setObjects(serverObjects || []);
    });

    socket.on('startStroke', (stroke) => {
      setObjects((prev) => [...prev, stroke]);
    });

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

    socket.on('deleteObject', (id) => {
      setObjects((prev) => prev.filter(obj => obj.id !== id));
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

  useEffect(() => {
    if (editingText) {
      setEditingText(prev => ({ ...prev, fontSize, textColor }));
    }
  }, [fontSize, textColor]);


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
        />
      )}
      {tool === 'select' && (
        <Selectbar
          selectedObjectId={selectedObjectId}
          deleteObject={deleteObject}
        />
      )}
      {tool === 'text' && (
        <Textbar
          fontSize={fontSize}
          setFontSize={setFontSize}
          textColor={textColor}
          setTextColor={setTextColor}
          setInteractingWithTextbar={setInteractingWithTextbar}
        />
      )}
      <div className="canvas-tools">
        <Toolbar
          tool={tool}
          setTool={setTool}
          handleClear={handleClear}
        />
        <div className="canvas-container">
          <Canvas
            ref={canvasRef}
            tool={tool}
            color={color}
            brushSize={brushSize}
            fontSize={fontSize}
            textColor={textColor}
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
              interactingWithTextbar={interactingWithTextbar}
            />
          )}
        </div>
      </div>
    </div>
  );
}