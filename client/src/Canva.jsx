import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import socket from './socket.js';
import './app.css';

const Canvas = forwardRef(function Canvas({ tool, color, brushSize, texts, setEditingText }, ref) {
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);

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

    return () => {
      socket.off('draw');
      socket.off('clear');
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

    texts.forEach((t) => {
      ctx.font = "16px Arial";
      ctx.fillStyle = "black";

      t.value.split("\n").forEach((line, i) => {
        ctx.fillText(line, t.x, t.y + i * 18);
      });
    });
  }, [texts]);

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.font = "32px Arial";
    ctx.fillStyle = "black";
    ctx.fillText("TEST", 100, 100);
  }, []);

  const startDraw = ({ nativeEvent: { offsetX, offsetY } }) => {
    isDrawing.current = true;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    const x = (offsetX / rect.width) * canvas.width;
    const y = (offsetY / rect.height) * canvas.height;
    const ctx = canvas.getContext('2d');

    if (tool === "text") {
      setEditingText({ x: x, y: y, value: "" });
      return;
    }

    ctx.beginPath();
    ctx.moveTo(x, y);

    socket.emit('draw', { x, y, type: 'start' });
  };

  const draw = ({ nativeEvent: { offsetX, offsetY } }) => {
    if (tool !== "draw") return;
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
    if (tool != "draw") return;
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