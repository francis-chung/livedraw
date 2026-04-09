import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import socket from './socket.js';
import './app.css';

// forwardRef: allows a ref to enter the function for useImperativeHandle
// to call a child function of that ref
const Canvas = forwardRef(function Canvas({ tool, color, brushSize, texts, setEditingText }, ref) {
  // useRef: similar to useState, but does not cause a screen re-render
  // only for when data not shown on-screen is modified
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const drawingOperationsRef = useRef([]);

  // loads server changes on mount
  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');

    // draws drawings from other people onto canvas
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

  // useImperativeHandle: custom adds methods to a parent's ref (App.jsx)
  // especially for imperative objects, such as canvas drawing
  // bypasses React state
  useImperativeHandle(ref, () => ({
    clear: () => {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }));

  // makes changes whenever brush options are changed locally
  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');

    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [color, brushSize]);

  // when program opens, open socket and draw according to other users' changes
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
  }, []);

  // nativeEvent wrapped in React event handler  
  const startDraw = ({ nativeEvent: { offsetX, offsetY } }) => {
    if (offsetX < 0 || offsetY < 0) return;
    isDrawing.current = true;

    const canvas = canvasRef.current;

    // correction code to ensure mouse movement corresponds to
    // proper location on screen
    const rect = canvas.getBoundingClientRect();

    const x = (offsetX / rect.width) * canvas.width;
    const y = (offsetY / rect.height) * canvas.height;
    const ctx = canvas.getContext('2d');

    // draws an empty textbox to the canvas if text tool selected
    // timeout to ensure that mouseDown does not trigger several 
    // textbox renders, causing textbox to unmount and disappearing
    // problems
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