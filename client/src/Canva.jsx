import { useRef, useEffect } from 'react'
import socket from './socket.js';

export default function Canvas() {
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    socket.on('draw', ({ x, y, type }) => {
      if (type === 'start') {
        ctx.beginPath();
        ctx.moveTo(x, y);
      } else if (type === 'move') {
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    });

    return () => socket.off('draw');
  }, []);

  const startDraw = ({ nativeEvent: { offsetX, offsetY } }) => {
    isDrawing.current = true;
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY);
    socket.emit('draw', { x: offsetX, y: offsetY, type: 'start' });
  };

  const draw = ({ nativeEvent: { offsetX, offsetY } }) => {
    if (!isDrawing.current) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(offsetX, offsetY);
    ctx.stroke();
    socket.emit('draw', { x: offsetX, y: offsetY, type: 'move' });
  };

  const stopDraw = () => {
    isDrawing.current = false;
    socket.emit('draw', { type: 'end' });
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
}