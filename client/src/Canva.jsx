import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import socket from './socket.js';
import './app.css';

const Canvas = forwardRef(function Canvas({ tool, color, brushSize, fontSize, textColor, objects, setObjects, selectedObjectIds, setSelectedObjectIds, hoveredObjectId, setHoveredObjectId, setEditingText }, ref) {
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const currentStrokeId = useRef(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const isSelecting = useRef(false);
  const selectionStart = useRef({ x: 0, y: 0 });
  const selectionBox = useRef(null);

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
    ctx.font = `${textObject.fontSize}px Arial`;
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
    if (object.type === 'box') {
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

  const drawSelection = (ctx, object, clicked, selectBox) => {
    const bounds = getObjectBounds(ctx, object);
    ctx.save();
    ctx.strokeStyle = '#0078d4';
    if (selectBox) {
      ctx.strokeStyle = '#8ebde0';
    }
    ctx.lineWidth = 1;
    if (clicked) {
      ctx.setLineDash([6, 4]);
    }
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
    if (tool !== "select") {
      setSelectedObjectIds([]);
    }
  }, [tool]);

  useEffect(() => {
    redraw();
  }, [objects, selectedObjectIds, hoveredObjectId]);

  const handleClick = ({ nativeEvent }) => {
    const { offsetX, offsetY } = nativeEvent;
    if (offsetX < 0 || offsetY < 0) return;

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
      socket.emit('startStroke', stroke);
    }

    else if (tool === 'select') {
      const hitObject = [...objects].reverse().find((obj) => isPointInsideObject(ctx, x, y, obj));
      if (hitObject) {
        if (selectedObjectIds.includes(hitObject.id)) {
          isDragging.current = true;
          dragStart.current = { x, y };
        } else {
          setSelectedObjectIds([hitObject.id]);
        }
      } else {
        setSelectedObjectIds([]);
        isSelecting.current = true;
        selectionStart.current = { x, y };
        selectionBox.current = { x, y, width: 0, height: 0 };
      }
    }

    else if (tool === 'text') {
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
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

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

    else if (tool === 'select') {
      if (isDragging.current) {
        const dx = x - dragStart.current.x;
        const dy = y - dragStart.current.y;
        const selectedSet = new Set(selectedObjectIds);

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

        dragStart.current = { x, y };
      } else if (isSelecting.current) {
        const start = selectionStart.current;

        selectionBox.current = {
          x: Math.min(start.x, x),
          y: Math.min(start.y, y),
          width: Math.abs(x - start.x),
          height: Math.abs(y - start.y)
        };
        redraw();
      } else {
        const hitObject = [...objects].reverse().find((obj) => isPointInsideObject(ctx, x, y, obj));
        setHoveredObjectId((hitObject && !selectedObjectIds.includes(hitObject.id)) ? hitObject.id : null);
      }
    }
  };

  const handleLeave = () => {
    if (isSelecting.current && selectionBox.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const box = selectionBox.current;

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