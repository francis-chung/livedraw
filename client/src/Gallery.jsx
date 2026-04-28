import { useState, useEffect } from 'react';
import socket from './socket.js';
import './gallery.css';

export default function Gallery({ setCurrentView, onNewCanvas }) {
    const [savedCanvases, setSavedCanvases] = useState([]);

    useEffect(() => {
        // requests list of saved canvases
        // this initiates a chain reaction that causes savedCanvases to be called        
        socket.emit('getSavedCanvases');

        socket.on('savedCanvases', (canvases) => {
            setSavedCanvases(canvases);
        });

        // comes from chain reaction of socket connections initiated by handleDeleteCanvas 
        socket.on('canvasDeleted', (name) => {
            alert(`Canvas "${name}" deleted.`);
            socket.emit('getSavedCanvases');
        });

        socket.on('deleteError', (error) => {
            alert(`Error deleting canvas: ${error}`);
        });

        return () => {
            socket.off('savedCanvases');
            socket.off('canvasDeleted');
            socket.off('deleteError');
        };
    }, []);

    const handleLoadCanvas = (name) => {
        socket.emit('loadCanvas', name);
        setCurrentView('canvas');
    };

    const handleDeleteCanvas = (name) => {
        if (window.confirm(`Delete canvas "${name}"? This cannot be undone.`)) {
            socket.emit('deleteCanvas', name);
        }
    };

    const handleBack = () => {
        if (onNewCanvas) {
            onNewCanvas();
        } else {
            setCurrentView('canvas');
        }
    };

    return (
        <div className="gallery">
            <header className="gallery-header">
                <h1>Canvas Gallery</h1>
                <button onClick={handleBack}>New Canvas</button>
            </header>
            <div className="gallery-content">
                {savedCanvases.length === 0 ? (
                    <p>No saved canvases yet. Create and save some drawings first!</p>
                ) : (
                    <div className="canvas-list">
                        {savedCanvases.map((name) => (
                            <div key={name} className="canvas-item">
                                <h3>{name}</h3>
                                <div className="buttons">
                                    <button className="load" onClick={() => handleLoadCanvas(name)}>Load</button>
                                    <button className="delete" onClick={() => handleDeleteCanvas(name)}>Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}