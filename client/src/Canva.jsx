import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import socket from './socket.js';
import './app.css';

const Canvas = forwardRef(function Canvas({ tool, color, brushSize, objects, setObjects, selectedObjectId, setSelectedObjectId, setEditingText }, ref) {
  // useRef: similar to useState, but does not cause a screen re-render
  // only for when data not shown on-screen is modified  
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const currentStrokeId = useRef(null);

  // useImperativeHandle: custom adds methods to a parent's ref (App.jsx)
  // especially for imperative objects, such as canvas drawing
  // bypasses React state
  useImperativeHandle(ref, () => ({
    clear: () => {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
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
      x: (offsetX / rect.width) * canvas.width,
      y: (offsetY / rect.height) * canvas.height,
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
    ctx.font = `${fontSize}px Arial`;

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

  const drawStroke = (ctx, stroke) => {
    if (!stroke.points || stroke.points.length === 0) return;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;

    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    // calls lineTo(...) for each point from index 1
    stroke.points.slice(1).forEach(({ x, y }) => ctx.lineTo(x, y));
    ctx.stroke();
  };

  const drawText = (ctx, textObject) => {
    const fontSize = textObject.fontSize || 16;
    ctx.font = `${fontSize}px Arial`;
    ctx.fillStyle = textObject.color || 'black';

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
    ctx.clearRect(0, 0, canvas.width, canvas.height);

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

  // redraws every time objects are added or selected
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    redraw();
  }, [objects, selectedObjectId]);

  // finds uppermost object selected by mouse and changes ID state
  const handleSelection = ({ nativeEvent }) => {
    const { x, y } = getCanvasCoords(nativeEvent);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // searches objects in reverse order to find uppermost
    // object in stack
    const hitObject = [...objects].reverse().find((object) => isPointInsideObject(ctx, x, y, object));
    setSelectedObjectId(hitObject ? hitObject.id : null);
  };

  const startDraw = ({ nativeEvent }) => {
    const { offsetX, offsetY } = nativeEvent;
    if (offsetX < 0 || offsetY < 0) return;

    if (tool === 'select') {
      handleSelection({ nativeEvent });
      return;
    }

    const { x, y } = getCanvasCoords(nativeEvent);
    const canvas = canvasRef.current;
    if (!canvas) return;

    // setTimeout() required so clicking on canvas doesn't focus 
    // on canvas again and trigger onBlur() after initially creating textbox
    if (tool === 'text') {
      setTimeout(() => {
        setEditingText({
          id: crypto.randomUUID(),
          type: 'text',
          x,
          y,
          value: '',
          color: 'black',
          fontSize: 16,
        });
      }, 0);
      return;
    }

    if (tool !== 'draw') return;

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
  };

  const draw = ({ nativeEvent }) => {
    if (tool !== 'draw' || !isDrawing.current) return;

    const { x, y } = getCanvasCoords(nativeEvent);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    setObjects((prev) => prev.map((obj) =>
      obj.id === currentStrokeId.current && obj.type === 'stroke'
        ? { ...obj, points: [...obj.points, { x, y }] }
        : obj
    ));

    const currentStroke = objects.find((object) => object.id === currentStrokeId.current);
    if (currentStroke) {
      ctx.strokeStyle = currentStroke.color;
      ctx.lineWidth = currentStroke.width;
      ctx.beginPath();
      const lastPoint = currentStroke.points[currentStroke.points.length - 1];
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    socket.emit('appendStroke', {
      id: currentStrokeId.current,
      point: { x, y },
    });
  };

  const stopDraw = () => {
    isDrawing.current = false;
    currentStrokeId.current = null;
  };

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={600}
      onMouseDown={startDraw}
      onMouseMove={draw}
      onMouseUp={stopDraw}
      onMouseLeave={stopDraw}
    />
  );
});

export default Canvas;