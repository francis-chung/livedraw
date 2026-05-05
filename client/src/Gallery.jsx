import { useState, useEffect } from 'react';
import { Stage, Layer, Line, Text } from 'react-konva';
import socket from './socket.js';
import './gallery.css';
import { getFlatPoints, renderObject } from './utils.jsx';

const scaleFactor = 0.25;

const scaleObject = (obj) => {
    if (obj.type === 'stroke' || obj.type === 'line') {
        return {
            ...obj,
            x: obj.x * scaleFactor,
            y: obj.y * scaleFactor,
            width: obj.width * scaleFactor,
            points: obj.points.map(p => ({ x: p.x * scaleFactor, y: p.y * scaleFactor }))
        };
    }
    if (obj.type === 'text') {
        return {
            ...obj,
            x: obj.x * scaleFactor,
            y: obj.y * scaleFactor,
            fontSize: obj.fontSize * scaleFactor
        };
    }
    return obj;
};

export default function Gallery({ setCurrentView, onNewCanvas }) {
    const [savedCanvases, setSavedCanvases] = useState([]);

    useEffect(() => {
        socket.emit('getSavedCanvases');

        socket.on('savedCanvases', (canvases) => {
            setSavedCanvases(canvases);
        });

        socket.on('savedCanvasesError', (error) => {
            alert(`Error loading saved canvases: ${error}`);
            setSavedCanvases([]);
        });

        socket.on('canvasDeleted', (name) => {
            alert(`Canvas "${name}" deleted.`);
            socket.emit('getSavedCanvases');
        });

        socket.on('deleteError', (error) => {
            alert(`Error deleting canvas: ${error}`);
        });

        return () => {
            socket.off('savedCanvases');
            socket.off('savedCanvasesError');
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
                        {savedCanvases.map((canvas) => (
                            <div key={canvas.name} className="canvas-item">
                                <h3>{canvas.name}</h3>
                                <div className="preview">
                                    <Stage width={200} height={150}>
                                        <Layer>
                                            {canvas.objects.map(obj => {
                                                const scaled = scaleObject(obj);
                                                return renderObject({ object: scaled });
                                            })}
                                        </Layer>
                                    </Stage>
                                </div>
                                <div className="buttons">
                                    <button className="load" onClick={() => handleLoadCanvas(canvas.name)}>Load</button>
                                    <button className="delete" onClick={() => handleDeleteCanvas(canvas.name)}>Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}