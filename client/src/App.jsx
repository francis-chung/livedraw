import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
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
import { ConfirmSignOut } from './Dialogs.jsx';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

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
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const pendingNavigationViewRef = useRef(null);
  const supabaseRef = useRef(null);

  // Initialize Supabase client
  useEffect(() => {
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      supabaseRef.current = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        if (!supabaseRef.current) {
          setIsCheckingSession(false);
          return;
        }

        const { data: { session } } = await supabaseRef.current.auth.getSession();

        if (session?.access_token && session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || '',
            picture: session.user.user_metadata?.avatar_url || '',
            accessToken: session.access_token
          });
        }
      } catch (error) {
        console.error('Session check error:', error);
      } finally {
        setIsCheckingSession(false);
      }
    };

    checkSession();

    // Set up auth state listener
    if (supabaseRef.current) {
      const { data: { subscription } } = supabaseRef.current.auth.onAuthStateChange(
        async (event, session) => {
          if (event === 'SIGNED_IN' && session?.access_token) {
            setUser({
              id: session.user.id,
              email: session.user.email,
              name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || '',
              picture: session.user.user_metadata?.avatar_url || '',
              accessToken: session.access_token
            });
          } else if (event === 'SIGNED_OUT') {
            setUser(null);
            if (socket.connected) {
              socket.disconnect();
            }
          }
        }
      );

      return () => subscription?.unsubscribe();
    }
  }, []);

  const handleSignOutRequest = () => {
    setIsSignOutPromptOpen(true);
  };

  const handleConfirmSignOut = async () => {
    setIsSignOutPromptOpen(false);
    try {
      if (supabaseRef.current) {
        await supabaseRef.current.auth.signOut();
      }
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const handleCancelSignOut = () => {
    setIsSignOutPromptOpen(false);
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
  }, []);

  useEffect(() => {
    if (!user) return;

    socket.auth = {
      accessToken: user.accessToken
    };

    const onConnect = () => {
      socket.emit('authenticate', { accessToken: user.accessToken });
    };

    const onSessionVerified = () => {
      console.log('Session verified successfully');
    };

    const onAuthenticated = (profile) => {
      console.log('Authenticated user:', profile?.email || profile?.name);
    };

    const onAuthenticationError = (error) => {
      console.error('Authentication error:', error);
      setUser(null);
      alert('Authentication failed. Please sign in again.');
    };

    const onLoadState = ({ objects: serverObjects, name }) => {
      setObjects(serverObjects || []);
      if (name) {
        setCurrentCanvasName(name);
        setCurrentDrawingTitle(name);
      } else {
        setCurrentCanvasName(null);
      }
    };

    const onAddObject = (object) => {
      setObjects((prev) => [...prev, object]);
    };

    const onUpdateObject = (object) => {
      setObjects((prev) => prev.map(obj =>
        obj.id === object.id ? object : obj
      ));
    };

    const onMoveObjects = (ids, dp) => {
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
    };

    const onDeleteObjects = (ids) => {
      setObjects((prev) => prev.filter(obj => !ids.includes(obj.id)));
    };

    const onClear = () => {
      setObjects([]);
      setSelectedObjectIds([]);
    };

    const onCanvasSaved = (name) => {
      alert(`Canvas "${name}" saved successfully!`);
      setCurrentDrawingTitle(name);
      if (pendingNavigationViewRef.current) {
        setCurrentView(pendingNavigationViewRef.current);
        pendingNavigationViewRef.current = null;
        sidebarRef.current.closeSidebar();
      }
    };

    const onSaveError = (error) => {
      pendingNavigationViewRef.current = null;
      alert(`Error saving canvas: ${error}`);
    };

    const onLoadError = (error) => {
      alert(`Error loading canvas: ${error}`);
    };

    socket.on('connect', onConnect);
    socket.on('sessionVerified', onSessionVerified);
    socket.on('authenticated', onAuthenticated);
    socket.on('authenticationError', onAuthenticationError);
    socket.on('loadState', onLoadState);
    socket.on('addObject', onAddObject);
    socket.on('updateObject', onUpdateObject);
    socket.on('moveObjects', onMoveObjects);
    socket.on('deleteObjects', onDeleteObjects);
    socket.on('clear', onClear);
    socket.on('canvasSaved', onCanvasSaved);
    socket.on('saveError', onSaveError);
    socket.on('loadError', onLoadError);

    if (!socket.connected) {
      socket.connect();
    } else {
      onConnect();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('sessionVerified', onSessionVerified);
      socket.off('authenticated', onAuthenticated);
      socket.off('authenticationError', onAuthenticationError);
      socket.off('loadState', onLoadState);
      socket.off('addObject', onAddObject);
      socket.off('updateObject', onUpdateObject);
      socket.off('moveObjects', onMoveObjects);
      socket.off('deleteObjects', onDeleteObjects);
      socket.off('clear', onClear);
      socket.off('canvasSaved', onCanvasSaved);
      socket.off('saveError', onSaveError);
      socket.off('loadError', onLoadError);
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

  if (isCheckingSession) {
    return (
      <div className="app">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Welcome />;
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

      {isSignOutPromptOpen && <ConfirmSignOut
        handleCancelSignOut={handleCancelSignOut}
        handleConfirmSignOut={handleConfirmSignOut} />
      }
      {currentView === 'gallery' ? (
        <Gallery setCurrentView={setCurrentView} onNewCanvas={handleNewCanvas} />
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