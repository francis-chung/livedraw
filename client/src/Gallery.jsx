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

export default function Gallery({ user, isAuthenticated, setCurrentView, onNewCanvas, setCurrentDrawingTitle }) {
    const [savedCanvases, setSavedCanvases] = useState([]);
    const [canvasesLoading, setCanvasesLoading] = useState(true);

    useEffect(() => {
        const onSavedCanvases = (canvases) => {
            setCanvasesLoading(false);
            setSavedCanvases(canvases);
        };

        const onSavedCanvasesError = (error) => {
            alert(`Error loading saved canvases: ${error}`);
            setSavedCanvases([]);
        };

        const onCanvasDeleted = (name) => {
            alert(`Canvas "${name}" deleted.`);
            socket.emit('getSavedCanvases');
        };

        const onDeleteError = (error) => {
            alert(`Error deleting canvas: ${error}`);
        };

        socket.on('savedCanvases', onSavedCanvases);
        socket.on('savedCanvasesError', onSavedCanvasesError);
        socket.on('canvasDeleted', onCanvasDeleted);
        socket.on('deleteError', onDeleteError);

        return () => {
            socket.off('savedCanvases', onSavedCanvases);
            socket.off('savedCanvasesError', onSavedCanvasesError);
            socket.off('canvasDeleted', onCanvasDeleted);
            socket.off('deleteError', onDeleteError);
        };
    }, []);

    useEffect(() => {
        if (!isAuthenticated) return;
        socket.emit('getSavedCanvases');
    }, [isAuthenticated]);

    const handleLoadCanvas = (canvas) => {
        setCurrentDrawingTitle("Loading...");
        socket.emit('loadCanvas', { id: canvas.id });
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
                {canvasesLoading ? (
                    <p>Loading canvases...</p>
                ) :
                    (
                        savedCanvases.length === 0 ? (
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
                                            <button className="load" onClick={() => handleLoadCanvas(canvas)}>Load</button>
                                            {!canvas.shared && <button className="delete" onClick={() => handleDeleteCanvas(canvas.name)}>Delete</button>}
                                        {canvas.shared && <span className="shared-label">Shared ({canvas.role})</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    )
                }
            </div>
        </div>
    );
}