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

// keys required to create supabase client
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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const pendingNavigationViewRef = useRef(null);
  // uses ref because it survives re-renders
  const supabaseRef = useRef(null);

  // initialize supabase client
  useEffect(() => {
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      supabaseRef.current = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
  }, []);

  // check for existing session on mount, and listens for auth changes later
  useEffect(() => {
    // checks whether supabase already has a saved login session
    const checkSession = async () => {
      try {
        // if client not initialized
        if (!supabaseRef.current) {
          setIsCheckingSession(false);
          return;
        }

        // obtains session from supabase, determines whether user was previously logged in
        const { data: { session } } = await supabaseRef.current.auth.getSession();
        // if access token and user are valid (login was already available)
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
      } finally { // runs whether or not an error was raised
        setIsCheckingSession(false);
      }
    };

    checkSession();

    // set up auth state listener
    if (supabaseRef.current) {
      // invokes inside function whenever auth changes, such as sign in/out
      // has branching depending on the event
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
            // disconnects to remove access to secure data
            if (socket.connected) {
              socket.disconnect();
            }
          }
        }
      );

      // removes auth listener to prevent duplicates or leaks when component unmounts
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
  }, []);

  // each of the event listeners have a separate, named function call
  // which can be removed properly on unmount (as opposed to anonymous 
  // functions that aren't properly removed)
  // if not fixed, this causes duplicate listeners that don't properly 
  // receive socket emits
  useEffect(() => {
    // socket only connects if user is logged in
    if (!user) return;

    // sends authentication data to server when socket connects
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
      setIsAuthenticated(true);
    };

    const onAuthenticationError = (error) => {
      console.error('Authentication error:', error);
      setUser(null);
      alert('Authentication failed. Please sign in again.');
    };

    // waits for server updates, then sends changes to canvas      
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
      // updates drawing title on-screen before exiting
      setCurrentDrawingTitle(name);
      if (pendingNavigationViewRef.current) {
        setCurrentView(pendingNavigationViewRef.current);
        pendingNavigationViewRef.current = null;
        // waits for the current view to change before calling 
        // child component's function and closing the sidebar
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

  // changes editingText properties if options were changed midway
  // NOTE: would not prefer putting this useEffect here, but this file 
  // is the closest (and only) ancestor of both Textbar and Textbox files
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
        <Gallery
          isAuthenticated={isAuthenticated}
          setCurrentView={setCurrentView}
          onNewCanvas={handleNewCanvas} />
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