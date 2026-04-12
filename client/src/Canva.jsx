import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import socket from './socket.js';
import './app.css';

const Canvas = forwardRef(function Canvas({ tool, color, brushSize, fontSize, textColor, objects, setObjects, selectedObjectId, setSelectedObjectId, setEditingText }, ref) {
  // useRef: similar to useState, but does not cause a screen re-render
  // only for when data not shown on-screen is modified  
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const currentStrokeId = useRef(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // size of the canvas
  const displayWidth = 800;
  const displayHeight = 600;

  // useImperativeHandle: custom adds methods to a parent's ref (App.jsx)
  // especially for imperative objects, such as canvas drawing
  // bypasses React state  
  useImperativeHandle(ref, () => ({
    clear: () => {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, displayWidth, displayHeight);
    }
  }));

  // converts coordinates relative to displayed canvas into 
  // coordinates relative to internal drawing system
  const getCanvasCoords = ({ offsetX, offsetY }) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // divide by rect variables to normalize, then multiply 
    // by canvas variables so canvas can draw in the right place
    return {
      x: (offsetX / rect.width) * displayWidth,
      y: (offsetY / rect.height) * displayHeight,
    };
  };

  // creates stroke bounding box for selection tool
  const getStrokeBounds = (points, width) => {
    // zero-sized box
    if (!points || points.length === 0) {
      return { left: 0, top: 0, width: 0, height: 0 };
    }

    // creates arrays of x- and y-coordinates separately
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);

    // finds extremum value, then accounts for thickness of 
    // stroke (strokes are drawn centered on path) and safety margin
    const left = Math.min(...xs) - width / 2 - 4;
    const right = Math.max(...xs) + width / 2 + 4;
    const top = Math.min(...ys) - width / 2 - 4;
    const bottom = Math.max(...ys) + width / 2 + 4;

    return { left, top, width: right - left, height: bottom - top };
  };

  // creates text bounding box for selection tool
  const getTextBounds = (ctx, textObject) => {
    const fontSize = textObject.fontSize || 16;
    // ctx.measureText(...) relies on accurate font definition
    ctx.font = `${textObject.fontSize}px Arial`;
    const lines = (textObject.value || '').split('\n');
    const lineHeight = fontSize * 1.2;

    // find the widest line in textObject
    const width = Math.max(...lines.map((line) => ctx.measureText(line).width), 0);

    // canvas text positioned using baseline, so top must account for this
    // also adds for padding
    return {
      left: textObject.x - 4,
      top: textObject.y - fontSize - 4,
      width: width + 8,
      height: lines.length * lineHeight + 8,
    };
  };

  // creates bounding boxes for any type of object
  const getObjectBounds = (ctx, object) => {
    if (object.type === 'stroke') {
      return getStrokeBounds(object.points, object.width);
    }
    if (object.type === 'text') {
      return getTextBounds(ctx, object);
    }
    return { left: 0, top: 0, width: 0, height: 0 };
  };

  const isPointInsideObject = (ctx, x, y, object) => {
    const bounds = getObjectBounds(ctx, object);
    return x >= bounds.left && x <= bounds.left + bounds.width && y >= bounds.top && y <= bounds.top + bounds.height;
  };

  // helper function to make stroke re-rendering and incremental
  // point adding more compact
  const drawSegment = (ctx, p1, p2, stroke) => {
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  };

  const drawStroke = (ctx, stroke) => {
    if (!stroke.points || stroke.points.length === 0) return;
    const points = stroke.points;
    for (let i = 1; i < points.length; i++) {
      drawSegment(ctx, points[i - 1], points[i], stroke);
    }
  };

  const drawText = (ctx, textObject) => {
    ctx.font = `${textObject.fontSize}px Arial`;
    ctx.fillStyle = textObject.textColor;
    const lines = (textObject.value || '').split('\n');
    lines.forEach((line, index) => {
      ctx.fillText(line, textObject.x, textObject.y + index * fontSize * 1.2);
    });
  };

  const drawSelection = (ctx, object) => {
    const bounds = getObjectBounds(ctx, object);

    // stores the current state of ctx so that later modifications
    // can be easily removed
    ctx.save();
    ctx.strokeStyle = '#0078d4';
    ctx.lineWidth = 1;
    // 6px drawn, 4px gap 
    ctx.setLineDash([6, 4]);

    // draws rectangular outline
    ctx.strokeRect(bounds.left, bounds.top, bounds.width, bounds.height);
    // removes all temporary modifications of ctx and restores
    // previous state
    ctx.restore();
  };

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    objects.forEach((object) => {
      if (object.type === 'stroke') {
        drawStroke(ctx, object);
      } else if (object.type === 'text') {
        drawText(ctx, object);
      }
    });

    const selectedObject = objects.find((object) => object.id === selectedObjectId);
    if (selectedObject) {
      drawSelection(ctx, selectedObject);
    }
  };

  // runs on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // since CSS pixels and device pixels differ, an adjustment is made
    const dpr = window.devicePixelRatio || 1;
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;

    // every coordinate drawn on-screen is also scaled to prevent offsets
    ctx.scale(dpr, dpr);
    // visual size of canvas remains the same despite internal changes
    canvas.style.width = displayWidth + 'px';
    canvas.style.height = displayHeight + 'px';

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  // redraws every time objects are added or selected
  useEffect(() => {
    if (tool !== "select") {
      setSelectedObjectId(null);
    }
  }, [tool]);

  useEffect(() => {
    redraw();
  }, [objects, selectedObjectId]);

  const handleClick = ({ nativeEvent }) => {
    const { offsetX, offsetY } = nativeEvent;
    if (offsetX < 0 || offsetY < 0) return;

    const { x, y } = getCanvasCoords(nativeEvent);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (tool === 'draw') {
      setSelectedObjectId(null);
      isDrawing.current = true;
      const stroke = {
        id: crypto.randomUUID(),
        type: 'stroke',
        color,
        width: brushSize,
        points: [{ x, y }],
      };

      setObjects((prev) => [...prev, stroke]);
      currentStrokeId.current = stroke.id;
      socket.emit('startStroke', stroke);
    }

    else if (tool === 'select') {
      // searches objects in reverse order to find uppermost
      // object in stack
      const hitObject = [...objects].reverse().find((obj) => isPointInsideObject(ctx, x, y, obj));

      // selects a new object if applicable; otherwise, begin dragging
      if (!hitObject || selectedObjectId !== hitObject.id) {
        setSelectedObjectId(hitObject ? hitObject.id : null);
      } else {
        isDragging.current = true;
        dragStart.current = { x, y };
      }
    }

    else if (tool === 'text') {
      // setTimeout() required so clicking on canvas doesn't focus 
      // on canvas again and trigger onBlur() after initially creating textbox    
      setTimeout(() => {
        setEditingText({
          id: crypto.randomUUID(),
          type: 'text',
          x,
          y,
          value: '',
          textColor: textColor,
          fontSize: fontSize,
        });
      }, 0);
    }
  };

  const handleDrag = ({ nativeEvent }) => {
    const { x, y } = getCanvasCoords(nativeEvent);

    if (tool === 'draw') {
      setObjects((prev) => prev.map((obj) =>
        obj.id === currentStrokeId.current && obj.type === 'stroke'
          ? { ...obj, points: [...obj.points, { x, y }] }
          : obj
      ));

      socket.emit('appendStroke', {
        id: currentStrokeId.current,
        point: { x, y },
      });
    }

    else if (tool === 'select' && isDragging.current && selectedObjectId) {
      const dx = x - dragStart.current.x;
      const dy = y - dragStart.current.y;

      // moves the each of the selected object's coordinates by {dx, dy}
      setObjects((prev) => prev.map((obj) => {
        if (obj.id !== selectedObjectId) return obj;
        if (obj.type === 'stroke') {
          return {
            ...obj,
            points: obj.points.map((p) => ({
              x: p.x + dx,
              y: p.y + dy
            }))
          };
        }
        if (obj.type === 'text') {
          return {
            ...obj,
            x: obj.x + dx,
            y: obj.y + dy
          };
        }
        return obj;
      }));

      // updates reference point for dragging
      dragStart.current = { x, y };
    }
  };

  const handleLeave = () => {
    isDrawing.current = false;
    currentStrokeId.current = null;
    isDragging.current = false;
  };

  return (
    <canvas
      ref={canvasRef}
      width={displayWidth}
      height={displayHeight}
      onMouseDown={handleClick}
      onMouseMove={handleDrag}
      onMouseUp={handleLeave}
      onMouseLeave={handleLeave}
    />
  );
});

export default Canvas;