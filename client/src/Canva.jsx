import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import socket from './socket.js';
import './app.css';

const Canvas = forwardRef(function Canvas({ tool, color, brushSize, objects, setObjects, selectedObjectId, setSelectedObjectId, setEditingText }, ref) {
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const currentStrokeId = useRef(null);

  const displayWidth = 800;
  const displayHeight = 600;

  useImperativeHandle(ref, () => ({
    clear: () => {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, displayWidth, displayHeight);
    }
  }));

  const getCanvasCoords = ({ offsetX, offsetY }) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (offsetX / rect.width) * displayWidth,
      y: (offsetY / rect.height) * displayHeight,
    };
  };

  const getStrokeBounds = (points, width) => {
    if (!points || points.length === 0) {
      return { left: 0, top: 0, width: 0, height: 0 };
    }
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const left = Math.min(...xs) - width / 2 - 4;
    const right = Math.max(...xs) + width / 2 + 4;
    const top = Math.min(...ys) - width / 2 - 4;
    const bottom = Math.max(...ys) + width / 2 + 4;
    return { left, top, width: right - left, height: bottom - top };
  };

  const getTextBounds = (ctx, textObject) => {
    const fontSize = textObject.fontSize || 16;
    ctx.font = `${fontSize}px Arial`;
    const lines = (textObject.value || '').split('\n');
    const lineHeight = fontSize * 1.2;
    const width = Math.max(...lines.map((line) => ctx.measureText(line).width), 0);
    return {
      left: textObject.x - 4,
      top: textObject.y - fontSize - 4,
      width: width + 8,
      height: lines.length * lineHeight + 8,
    };
  };

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
    ctx.save();
    ctx.strokeStyle = '#0078d4';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(bounds.left, bounds.top, bounds.width, bounds.height);
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const dpr = window.devicePixelRatio || 1;
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;

    ctx.scale(dpr, dpr);
    canvas.style.width = displayWidth + 'px';
    canvas.style.height = displayHeight + 'px';

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  useEffect(() => {
    redraw();
  }, [objects, selectedObjectId]);

  const handleSelection = ({ nativeEvent }) => {
    const { x, y } = getCanvasCoords(nativeEvent);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
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
      const points = currentStroke.points;
      const last = points[points.length - 2];
      const current = points[points.length - 1];
      drawSegment(ctx, last, current, stroke);
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