import { useState, useEffect, useRef } from 'react';
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
  const stageRef = useRef(null);
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(2);
  const [fontSize, setFontSize] = useState(16);
  const [textColor, setTextColor] = useState('#000000');
  const [tool, setTool] = useState('draw');
  const [objects, setObjects] = useState([]);
  const [editingText, setEditingText] = useState(null);
  const [selectedObjectIds, setSelectedObjectIds] = useState([]);
  const [hoveredObjectIds, setHoveredObjectIds] = useState([]);
  const [isChangingText, setIsChangingText] = useState(false);
  const [interactingWithTextbar, setInteractingWithTextbar] = useState(false);

  // clear screen function
  const handleClear = () => {
    setObjects([]);
    setSelectedObjectIds([]);
    socket.emit('clear');
  };

  // removes the selected objects from canvas  
  const deleteObjects = (objectIds) => {
    setObjects((prev) => prev.filter(obj => !objectIds.includes(obj.id)));
    setSelectedObjectIds([]);
    socket.emit('deleteObjects', objectIds);
  }

  useEffect(() => {
    // removes preload class to reenable transitions after initial loading    
    document.body.classList.remove('preload');

    // waits for server updates, then sends changes to canvas
    socket.on('loadState', ({ objects: serverObjects }) => {
      setObjects(serverObjects || []);
    });

    socket.on('addObject', (object) => {
      setObjects((prev) => [...prev, object]);
    });

    socket.on('updateObject', (object) => {
      setObjects((prev) => prev.map(obj =>
        obj.id === object.id ? object : obj
      ));
    });

    socket.on('moveObjects', (ids, dp) => {
      const idSet = new Set(ids);
      setObjects((prev) => prev.map((obj) => {
        if (!idSet.has(obj.id)) return obj;
        if (obj.type === 'stroke') {
          return {
            ...obj,
            points: obj.points.map(p => ({
              x: p.x + dp.x,
              y: p.y + dp.y
            }))
          };
        }
        if (obj.type === 'text') {
          return {
            ...obj,
            x: obj.x + dp.x,
            y: obj.y + dp.y
          };
        }
        return obj;
      }));
    })

    socket.on('deleteObjects', (ids) => {
      setObjects((prev) => prev.filter(obj => !ids.includes(obj.id)));
    });

    socket.on('clear', () => {
      setObjects([]);
      setSelectedObjectIds([]);
    });

    return () => {
      socket.off('loadState');
      socket.off('addObject');
      socket.off('moveObjects');
      socket.off('deleteObjects');
      socket.off('clear');
    };
  }, [setObjects, setSelectedObjectIds]);

  // changes editingText properties if options were changed midway
  // NOTE: would not prefer putting this useEffect here, but this file 
  // is the closest (and only) ancestor of both Textbar and Textbox files
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
          selectedObjectIds={selectedObjectIds}
          deleteObjects={deleteObjects}
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
            stageRef={stageRef}
            tool={tool}
            setTool={setTool}
            color={color}
            brushSize={brushSize}
            fontSize={fontSize}
            textColor={textColor}
            objects={objects}
            setObjects={setObjects}
            selectedObjectIds={selectedObjectIds}
            setSelectedObjectIds={setSelectedObjectIds}
            hoveredObjectIds={hoveredObjectIds}
            setHoveredObjectIds={setHoveredObjectIds}
            editingText={editingText}
            setEditingText={setEditingText}
            setIsChangingText={setIsChangingText}
          />
          {tool === 'text' && editingText && (
            <Textbox
              stageBox={stageRef.current.container().getBoundingClientRect()}
              objects={objects}
              setObjects={setObjects}
              editingText={editingText}
              setEditingText={setEditingText}
              isChangingText={isChangingText}
              setIsChangingText={setIsChangingText}
              interactingWithTextbar={interactingWithTextbar}
            />
          )}
        </div>
      </div>
    </div>
  );
}