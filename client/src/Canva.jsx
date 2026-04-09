import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import socket from './socket.js';
import './app.css';

const Canvas = forwardRef(function Canvas({ tool, color, brushSize, texts, setEditingText }, ref) {
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const drawingOperationsRef = useRef([]);

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');

    const replayDrawings = (operations) => {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      operations.forEach(({ x, y, type, style, width }) => {
        ctx.strokeStyle = style;
        ctx.lineWidth = width;
        if (type === 'start') {
          ctx.beginPath();
          ctx.moveTo(x, y);
        } else if (type === 'move') {
          ctx.lineTo(x, y);
          ctx.stroke();
        }
      });
    };

    socket.on('loadState', ({ drawingOperations, textboxes: serverTextboxes }) => {
      drawingOperationsRef.current = drawingOperations;
      replayDrawings(drawingOperations);
    });

    socket.on('draw', ({ x, y, type }) => {
      drawingOperationsRef.current.push({ x, y, type, style, width });
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      if (type === 'start') {
        ctx.beginPath();
        ctx.moveTo(x, y);
      } else if (type === 'move') {
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    });

    socket.on('clear', () => {
      drawingOperationsRef.current = [];
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    });

    return () => {
      socket.off('draw');
      socket.off('clear');
      socket.off('loadState');
    };
  }, []);

  useImperativeHandle(ref, () => ({
    clear: () => {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }));

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');

    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [color, brushSize]);

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    drawingOperationsRef.current.forEach(({ x, y, type, style, width }) => {
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      if (type === 'start') {
        ctx.beginPath();
        ctx.moveTo(x, y);
      } else if (type === 'move') {
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    });

    texts.forEach((t) => {
      ctx.font = "16px Arial";
      ctx.fillStyle = "black";

      t.value.split("\n").forEach((line, i) => {
        ctx.fillText(line, t.x, t.y + i * 18);
      });
    });
  }, [texts]);

  const startDraw = ({ nativeEvent: { offsetX, offsetY } }) => {
    if (offsetX < 0 || offsetY < 0) return;
    isDrawing.current = true;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    const x = (offsetX / rect.width) * canvas.width;
    const y = (offsetY / rect.height) * canvas.height;
    const ctx = canvas.getContext('2d');

    if (tool === "text") {
      setTimeout(() => {
        setEditingText({
          id: crypto.randomUUID(),
          x,
          y,
          value: ""
        });
      }, 0);
      return;
    }

    drawingOperationsRef.current.push({ x, y, type: 'start', style: color, width: brushSize });
    console.log(brushSize);
    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
    ctx.beginPath();
    ctx.moveTo(x, y);

    socket.emit('draw', { x, y, type: 'start', style: color, width: brushSize });
  };

  const draw = ({ nativeEvent: { offsetX, offsetY } }) => {
    if (tool !== "draw") return;
    if (!isDrawing.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    const x = (offsetX / rect.width) * canvas.width;
    const y = (offsetY / rect.height) * canvas.height;
    const ctx = canvas.getContext('2d');

    drawingOperationsRef.current.push({ x, y, type: 'move', style: color, width: brushSize });
    console.log(brushSize);
    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
    ctx.lineTo(x, y);
    ctx.stroke();

    socket.emit('draw', { x, y, type: 'move', style: color, width: brushSize });
  };

  const stopDraw = () => {
    isDrawing.current = false;
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