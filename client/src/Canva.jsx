import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import socket from './socket.js';

// forwardRef: allows a ref to enter the function for useImperativeHandle
// to call a child function of that ref
const Canvas = forwardRef(function Canvas({ color, brushSize }, ref) {
  // useRef: similar to useState, but does not cause a screen re-render
  // only for when data not shown on-screen is modified
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);

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
  }, [color, brushSize]);

  // when program opens, open socket and draw according to other users' changes
  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');

    socket.on('draw', ({ x, y, type }) => {
      if (type === 'start') {
        ctx.beginPath();
        ctx.moveTo(x, y);
      } else if (type === 'move') {
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    });

    socket.on('clear', () => {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    });

    // when unmounting, offload
    return () => {
      socket.off('draw');
      socket.off('clear');
    };
  }, []);

  // nativeEvent wrapped in React event handler
  const startDraw = ({ nativeEvent: { offsetX, offsetY } }) => {
    isDrawing.current = true;
    const canvas = canvasRef.current;

    // correction code to ensure mouse movement corresponds to
    // proper location on screen
    const rect = canvas.getBoundingClientRect();
    const x = (offsetX / rect.width) * canvas.width;
    const y = (offsetY / rect.height) * canvas.height;

    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    socket.emit('draw', { x, y, type: 'start' });
  };

  const draw = ({ nativeEvent: { offsetX, offsetY } }) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;

    const rect = canvas.getBoundingClientRect();
    const x = (offsetX / rect.width) * canvas.width;
    const y = (offsetY / rect.height) * canvas.height;

    const ctx = canvas.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
    socket.emit('draw', { x, y, type: 'move' });
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
      style={{ border: '1px solid #ccc', cursor: 'crosshair' }}
    />
  );
});

export default Canvas;