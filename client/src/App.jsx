import { useState, useEffect, useRef } from 'react';
import Canvas from './Canva.jsx';
import socket from './socket.js';
import './App.css';
import SidebarMenu from './SidebarMenu.jsx';
import Drawbar from './Drawbar.jsx';
import Selectbar from './Selectbar.jsx';
import Textbar from './Textbar.jsx';
import Textbox from './Textbox.jsx';
import Toolbar from './Toolbar.jsx';
import Gallery from './Gallery.jsx';
import Welcome from './Welcome.jsx';

export default function App() {
  const stageRef = useRef(null);
  const sidebarRef = useRef(null);
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(2);
  const [fontSize, setFontSize] = useState(16);
  const [textColor, setTextColor] = useState('#000000');
  const [lineSize, setLineSize] = useState(2);
  const [lineColor, setLineColor] = useState('#000000');
  const [tool, setTool] = useState('draw');
  const [objects, setObjects] = useState([]);
  const [editingText, setEditingText] = useState(null);
  const [selectedObjectIds, setSelectedObjectIds] = useState([]);
  const [hoveredObjectIds, setHoveredObjectIds] = useState([]);
  const [isChangingText, setIsChangingText] = useState(false);
  const [interactingWithTextbar, setInteractingWithTextbar] = useState(false);
  const [currentView, setCurrentView] = useState('gallery');
  const [currentCanvasName, setCurrentCanvasName] = useState(null);
  const [currentDrawingTitle, setCurrentDrawingTitle] = useState('Untitled');
  const [user, setUser] = useState(null);
  const pendingNavigationViewRef = useRef(null);

  const handleSignIn = ({ profile, token }) => {
    const authUser = { ...profile, token };
    localStorage.setItem('livedrawUser', JSON.stringify(authUser));
    setUser(authUser);
  };

  const handleSignOut = () => {
    localStorage.removeItem('livedrawUser');
    setUser(null);
    if (socket.connected) {
      socket.disconnect();
    }
  };

  // clear screen function  
  const handleClear = () => {
    setObjects([]);
    setSelectedObjectIds([]);
    socket.emit('clear');
  };

  // resets all states, then leaves the current canvas if applicable
  const handleNewCanvas = () => {
    setObjects([]);
    setSelectedObjectIds([]);
    setHoveredObjectIds([]);
    setEditingText(null);
    setIsChangingText(false);
    setCurrentCanvasName(null);
    setCurrentDrawingTitle('Untitled');
    socket.emit('leaveCanvas');
    setCurrentView('canvas');
  };

  // galleryView parameter if redirecting to gallery
  const handleSave = (galleryView) => {
    const name = currentDrawingTitle && currentDrawingTitle !== 'Untitled'
      ? currentDrawingTitle
      : prompt('Enter a name for this canvas:');

    if (!name) return;

    if (galleryView) {
      pendingNavigationViewRef.current = 'gallery';
    }
    socket.emit('saveCanvas', { name, objects });
  };

  // passing this into hamburger menu is necessary so menu doesn't close
  // unexpectedly before gallery view is opened
  const handleGalleryClick = () => {
    handleSave(true);
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
    // initializes user state based on localStorage data
    const storedUser = localStorage.getItem('livedrawUser');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (err) {
        console.error('Invalid stored user', err);
      }
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    // sends authentication data to server when socket connects
    socket.auth = { user };

    socket.on('connect', () => {
      socket.emit('authenticate', { profile: user, token: user.token });
    });

    socket.on('authenticated', (profile) => {
      console.log('Authenticated user:', profile?.email || profile?.name);
    });

    socket.on('authenticationError', (error) => {
      console.error('Authentication error:', error);
      localStorage.removeItem('livedrawUser');
      setUser(null);
      alert('Authentication failed. Please sign in again.');
    });

    // waits for server updates, then sends changes to canvas       
    socket.on('loadState', ({ objects: serverObjects, name }) => {
      setObjects(serverObjects || []);
      if (name) {
        setCurrentCanvasName(name);
        setCurrentDrawingTitle(name);
      } else {
        setCurrentCanvasName(null);
      }
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
    });

    socket.on('deleteObjects', (ids) => {
      setObjects((prev) => prev.filter(obj => !ids.includes(obj.id)));
    });

    socket.on('clear', () => {
      setObjects([]);
      setSelectedObjectIds([]);
    });

    // creates popup alerts for the client       
    socket.on('canvasSaved', (name) => {
      alert(`Canvas "${name}" saved successfully!`);
      // updates drawing title on-screen before exiting
      setCurrentDrawingTitle(name);
      if (pendingNavigationViewRef.current) {
        setCurrentView(pendingNavigationViewRef.current);
        pendingNavigationViewRef.current = null;
        // waits for the current view to change before calling 
        // child component's function and closing the sidebar
        sidebarRef.current.closeSidebar();
      }
    });

    socket.on('saveError', (error) => {
      pendingNavigationViewRef.current = null;
      alert(`Error saving canvas: ${error}`);
    });

    socket.on('loadError', (error) => {
      alert(`Error loading canvas: ${error}`);
    });

    socket.connect();

    return () => {
      socket.off('connect');
      socket.off('authenticated');
      socket.off('authenticationError');
      socket.off('loadState');
      socket.off('addObject');
      socket.off('updateObject');
      socket.off('moveObjects');
      socket.off('deleteObjects');
      socket.off('clear');
      socket.off('canvasSaved');
      socket.off('saveError');
      socket.off('loadError');
      if (socket.connected) {
        socket.disconnect();
      }
    };
  }, [user]);

  // changes editingText properties if options were changed midway
  // NOTE: would not prefer putting this useEffect here, but this file 
  // is the closest (and only) ancestor of both Textbar and Textbox files
  useEffect(() => {
    if (editingText) {
      setEditingText(prev => ({ ...prev, fontSize, textColor }));
    }
  }, [fontSize, textColor]);

  if (!user) {
    return <Welcome onSignIn={handleSignIn} />;
  }

  return (
    <div className="app">
      <header className="header">
        <SidebarMenu user={user} onGalleryClick={handleGalleryClick} ref={sidebarRef} />
      </header>
      {currentView === 'gallery' ? (
        <Gallery setCurrentView={setCurrentView} onNewCanvas={handleNewCanvas} onSignOut={handleSignOut} />
      ) : (
        <>
          <header className="header">
            <h1>{currentDrawingTitle}</h1>
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
          {tool === 'line' && (
            <Drawbar
              color={lineColor}
              setColor={setLineColor}
              brushSize={lineSize}
              setBrushSize={setLineSize}
            />
          )}
          <div className="canvas-tools">
            <Toolbar
              tool={tool}
              setTool={setTool}
              handleClear={handleClear}
              handleSave={handleSave}
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
                lineSize={lineSize}
                lineColor={lineColor}
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
        </>
      )}
    </div>
  );
}