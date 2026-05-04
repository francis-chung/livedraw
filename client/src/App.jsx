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
  const [isSignOutPromptOpen, setIsSignOutPromptOpen] = useState(false);
  const pendingNavigationViewRef = useRef(null);

  const handleSignIn = ({ profile, token }) => {
    const authUser = { ...profile, token };
    localStorage.setItem('livedrawUser', JSON.stringify(authUser));
    setUser(authUser);
  };

  const handleSignOutRequest = () => {
    setIsSignOutPromptOpen(true);
  };

  const handleConfirmSignOut = () => {
    setIsSignOutPromptOpen(false);
    handleSignOut();
    sidebarRef.current?.closeSidebar();
  };

  const handleCancelSignOut = () => {
    setIsSignOutPromptOpen(false);
  };

  const handleSignOut = () => {
    localStorage.removeItem('livedrawUser');
    setUser(null);
    if (socket.connected) {
      socket.disconnect();
    }
  };

  const handleClear = () => {
    setObjects([]);
    setSelectedObjectIds([]);
    socket.emit('clear');
  };

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

  const handleGalleryClick = () => {
    handleSave(true);
  };

  const deleteObjects = (objectIds) => {
    setObjects((prev) => prev.filter(obj => !objectIds.includes(obj.id)));
    setSelectedObjectIds([]);
    socket.emit('deleteObjects', objectIds);
  }

  useEffect(() => {
    document.body.classList.remove('preload');
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

    socket.auth = {
      user,
      sessionToken: user.sessionToken
    };

    socket.on('connect', () => {
      if (user.sessionToken) {
        socket.emit('verifySession', { sessionToken: user.sessionToken });
      } else {
        socket.emit('authenticate', { profile: user, token: user.token });
      }
    });

    socket.on('sessionToken', (sessionToken) => {
      const updatedUser = { ...user, sessionToken };
      localStorage.setItem('livedrawUser', JSON.stringify(updatedUser));
      setUser(updatedUser);
    })

    socket.on('sessionVerified', () => {
      console.log('Session verified successfully');
    })

    socket.on('authenticated', (profile) => {
      console.log('Authenticated user:', profile?.email || profile?.name);
    });

    socket.on('authenticationError', (error) => {
      console.error('Authentication error:', error);
      localStorage.removeItem('livedrawUser');
      setUser(null);
      alert('Authentication failed. Please sign in again.');
    });

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

    socket.on('canvasSaved', (name) => {
      alert(`Canvas "${name}" saved successfully!`);
      setCurrentDrawingTitle(name);
      if (pendingNavigationViewRef.current) {
        setCurrentView(pendingNavigationViewRef.current);
        pendingNavigationViewRef.current = null;
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
        <SidebarMenu
          user={user}
          onGalleryClick={handleGalleryClick}
          onSignOutRequest={handleSignOutRequest}
          currentView={currentView}
          ref={sidebarRef} />
      </header>

      {isSignOutPromptOpen && (
        <div className="confirm-modal-backdrop" onClick={handleCancelSignOut}>
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="signout-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="signout-title">Are you sure?</h2>
            <p>Signing out will end your session and disconnect you from Livedraw.</p>
            <div className="modal-actions">
              <button className="modal-button cancel" onClick={handleCancelSignOut}>Cancel</button>
              <button className="modal-button confirm" onClick={handleConfirmSignOut}>Sign out</button>
            </div>
          </div>
        </div>
      )}
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