import { useState, useEffect } from 'react';
import socket from './socket.js';
import './gallery.css';

export default function Gallery({ setCurrentView }) {
    const [savedCanvases, setSavedCanvases] = useState([]);

    useEffect(() => {
        // Request list of saved canvases
        socket.emit('getSavedCanvases');

        socket.on('savedCanvases', (canvases) => {
            setSavedCanvases(canvases);
        });

        return () => {
            socket.off('savedCanvases');
        };
    }, []);

    const handleLoadCanvas = (name) => {
        socket.emit('loadCanvas', name);
        setCurrentView('canvas');
    };

    const handleBack = () => {
        setCurrentView('canvas');
    };

    return (
        <div className="gallery">
            <header className="gallery-header">
                <h1>Canvas Gallery</h1>
                <button onClick={handleBack}>Back to Canvas</button>
            </header>
            <div className="gallery-content">
                {savedCanvases.length === 0 ? (
                    <p>No saved canvases yet. Create and save some drawings first!</p>
                ) : (
                    <div className="canvas-list">
                        {savedCanvases.map((name) => (
                            <div key={name} className="canvas-item">
                                <h3>{name}</h3>
                                <button onClick={() => handleLoadCanvas(name)}>Load</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}