import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import socket from './socket.js';
import './app.css';

const Canvas = forwardRef(function Canvas({ tool, setTool, color, brushSize, fontSize, textColor, objects, setObjects, selectedObjectIds, setSelectedObjectIds, hoveredObjectId, setHoveredObjectId, editingText, setEditingText, setIsChangingText }, ref) {
  // useRef: similar to useState, but does not cause a screen re-render
  // only for when data not shown on-screen is modified     
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const currentStrokeId = useRef(null);
  const isDragging = useRef(false);
  const totalDelta = useRef({ x: 0, y: 0 });
  const dragPrev = useRef({ x: 0, y: 0 });
  const isSelecting = useRef(false);
  const selectionStart = useRef({ x: 0, y: 0 });
  const selectionBox = useRef(null);

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
    if (object.type === 'box') { // specifically for selectionBox for now
      return object;
    }
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

  const drawStroke = (ctx, stroke) => {
    if (!stroke.points || stroke.points.length === 0) return;
    const points = stroke.points;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    // creates a quadratic (Bezier) curve based on midpoints of defined points
    // depends on start point (previous point / midpoint), control point to 
    // pull the curve toward it (p1), and end point (new midpoint)
    for (let i = 1; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  };

  const drawText = (ctx, textObject) => {
    ctx.font = `${textObject.fontSize}px Arial`;
    ctx.fillStyle = textObject.textColor;
    const lines = (textObject.value || '').split('\n');
    lines.forEach((line, index) => {
      ctx.fillText(line, textObject.x, textObject.y + index * fontSize * 1.2);
    });
  };

  // boolean parameters after object used to modify box appearance based on functionality
  const drawSelection = (ctx, object, clicked, selectBox) => {
    const bounds = getObjectBounds(ctx, object);

    // stores the current state of ctx so that later modifications
    // can be easily removed
    ctx.save();
    ctx.strokeStyle = '#0078d4';
    if (selectBox) {
      ctx.strokeStyle = '#8ebde0';
    }
    ctx.lineWidth = 1;
    if (clicked) {
      // 6px drawn, 4px gap only if selected
      ctx.setLineDash([6, 4]);
    }
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
      } else if (object.type === 'text' && (!editingText || object.id !== editingText.id)) {
        drawText(ctx, object); // does not render the textbox being edited, if applicable
      }
    });

    if (selectedObjectIds.length > 0) {
      objects.forEach(obj => {
        if (selectedObjectIds.includes(obj.id)) {
          drawSelection(ctx, obj, true, false);
        }
      })
    }

    const hoveredObject = objects.find((object) => object.id === hoveredObjectId);
    if (hoveredObject) {
      drawSelection(ctx, hoveredObject, false, false);
    }

    if (isSelecting && selectionBox.current) {
      // creates a new object matching helper function parameters 
      // to facilitate drawing selection box
      const boxObject = {
        type: 'box',
        left: selectionBox.current.x,
        top: selectionBox.current.y,
        width: selectionBox.current.width,
        height: selectionBox.current.height
      };
      drawSelection(ctx, boxObject, false, true);
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
      setSelectedObjectIds([]);
      setHoveredObjectId(null);
    }
  }, [tool]);

  useEffect(() => {
    redraw();
  }, [objects, selectedObjectIds, hoveredObjectId]);

  const handleClick = ({ nativeEvent }) => {
    const { x, y } = getCanvasCoords(nativeEvent);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (tool === 'draw') {
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
    }

    else if (tool === 'select') {
      // searches objects in reverse order to find uppermost
      // object in stack
      const hitObject = [...objects].reverse().find((obj) => isPointInsideObject(ctx, x, y, obj));

      // drags objects if already selected; otherwise selects them
      if (hitObject) {
        if (selectedObjectIds.includes(hitObject.id)) {
          isDragging.current = true;
          dragPrev.current = { x, y };
        } else {
          setSelectedObjectIds([hitObject.id]);
        }
      } else { // enables multi-select if no object is clicked on
        setSelectedObjectIds([]);
        isSelecting.current = true;
        selectionStart.current = { x, y };
        selectionBox.current = { x, y, width: 0, height: 0 };
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

  const handleDoubleClick = ({ nativeEvent }) => {
    const { x, y } = getCanvasCoords(nativeEvent);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // enables editing an already-created textbox and switches to text tool
    if (tool === 'select') {
      const hitObject = [...objects].reverse().find((obj) => isPointInsideObject(ctx, x, y, obj));
      if (hitObject && hitObject.type === 'text') {
        setIsChangingText(true);
        setEditingText(hitObject);
        setTool('text');
      }
    }
  }

  const handleMove = ({ nativeEvent }) => {
    const { x, y } = getCanvasCoords(nativeEvent);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (tool === 'draw') {
      setObjects((prev) => prev.map((obj) =>
        obj.id === currentStrokeId.current && obj.type === 'stroke'
          ? { ...obj, points: [...obj.points, { x, y }] }
          : obj
      ));
    }

    else if (tool === 'select') {
      if (isDragging.current) {
        const dx = x - dragPrev.current.x;
        const dy = y - dragPrev.current.y;
        // accumulates delta change to compute final delta to send to server
        totalDelta.current.x += dx;
        totalDelta.current.y += dy;
        // using a set is not necessarily, but apparently provides better performance        
        const selectedSet = new Set(selectedObjectIds);

        // moves the each of the selected object's coordinates by {dx, dy}        
        setObjects((prev) => prev.map((obj) => {
          if (!selectedSet.has(obj.id)) return obj;
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
        dragPrev.current = { x, y };
      } else if (isSelecting.current) {
        const start = selectionStart.current;

        // recreates selectionBox based on current mouse coordinates
        selectionBox.current = {
          x: Math.min(start.x, x),
          y: Math.min(start.y, y),
          width: Math.abs(x - start.x),
          height: Math.abs(y - start.y)
        };

        // since selectionBox is a ref, useEffect cannot use it properly as a dependency
        // so redraw is manually called instead
        redraw();
      } else { // creates hover effect if object is not one of selected objects
        const hitObject = [...objects].reverse().find((obj) => isPointInsideObject(ctx, x, y, obj));
        setHoveredObjectId((hitObject && !selectedObjectIds.includes(hitObject.id)) ? hitObject.id : null);
      }
    }
  };

  const handleLeave = () => {
    if (isDrawing.current && currentStrokeId.current) {
      const stroke = objects.find(obj => obj.id === currentStrokeId.current);
      socket.emit('addObject', stroke);
    }

    if (isDragging.current) {
      socket.emit('moveObjects', selectedObjectIds, totalDelta.current);
    }

    // selects all objects bounded within selectionBox, if applicable
    if (isSelecting.current && selectionBox.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const box = selectionBox.current;

      // first finds all objects within selectionBox, then returns ids
      const selectedIds = objects
        .filter((obj => {
          const bounds = getObjectBounds(ctx, obj);

          return !(
            bounds.left > box.x + box.width ||
            bounds.left + bounds.width < box.x ||
            bounds.top > box.y + box.height ||
            bounds.top + bounds.height < box.y
          );
        }))
        .map(obj => obj.id);

      setSelectedObjectIds(selectedIds);
    }

    isSelecting.current = false;
    selectionBox.current = null;
    isDrawing.current = false;
    currentStrokeId.current = null;
    isDragging.current = false;
    totalDelta.current = { x: 0, y: 0 };
  };

  return (
    <canvas
      ref={canvasRef}
      width={displayWidth}
      height={displayHeight}
      onMouseDown={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseMove={handleMove}
      onMouseUp={handleLeave}
      onMouseLeave={handleLeave}
    />
  );
});

export default Canvas;