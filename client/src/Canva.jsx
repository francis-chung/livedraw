import { useRef, useEffect } from 'react'
import { Stage, Layer, Line, Text, Rect } from 'react-konva';
import socket from './socket.js';
import './app.css';
import { TextPath } from 'konva/lib/shapes/TextPath';
import { Path } from 'konva/lib/shapes/Path';

export default function Canvas({ stageRef, tool, setTool, color, brushSize, fontSize, textColor, objects, setObjects, selectedObjectIds, setSelectedObjectIds, hoveredObjectId, setHoveredObjectId, editingText, setEditingText, setIsChangingText }) {
  const isDrawing = useRef(false);
  const currentStrokeId = useRef(null);

  const stageWidth = 800;
  const stageHeight = 600;

  const getFlatPoints = (points) => points.flatMap((point) => [point.x, point.y]);

  const handleStageMouseDown = (e) => {
    const stage = e.target.getStage();
    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;
    const { x, y } = pointerPos;

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
      setSelectedObjectIds([]);
    } else if (tool === 'select') {
      setSelectedObjectIds([]);
    } else if (tool === 'text') {
      setTimeout(() => {
        setEditingText({
          id: crypto.randomUUID(),
          type: 'text',
          x: x,
          y: y,
          value: '',
          textColor,
          fontSize,
        });
      }, 0);
    }
  };

  const handleStageMouseMove = (e) => {
    if (!isDrawing.current || tool !== 'draw') return;
    const stage = e.target.getStage();
    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;
    const { x, y } = pointerPos;

    setObjects((prev) => prev.map((object) => {
      if (object.id !== currentStrokeId.current) return object;
      return { ...object, points: [...object.points, { x, y }] };
    }));
  };

  const handleStageMouseUp = () => {
    if (isDrawing.current) {
      isDrawing.current = false;
      currentStrokeId.current = null;
    }
  };

  const handleObjectClick = (object, e) => {
    if (tool === 'select') {
      setSelectedObjectIds([object.id]);
      e.cancelBubble = true;
    }
    if (tool === 'text' && object.type === 'text') {
      setIsChangingText(true);
      setEditingText(object);
      setTool('text');
      e.cancelBubble = true;
    }
  };

  const handleLineDragEnd = (objectId, e) => {
    const node = e.target;
    const dx = node.x();
    const dy = node.y();
    if (dx === 0 && dy === 0) return;

    setObjects((prev) => prev.map((object) => {
      if (object.id !== objectId) return object;
      return {
        ...object,
        points: object.points.map((point) => ({
          x: point.x + dx,
          y: point.y + dy,
        })),
      };
    }));

    node.position({ x: 0, y: 0 });
    socket.emit('moveObjects', [objectId], { x: dx, y: dy });
  };

  const handleTextDragEnd = (objectId, e) => {
    const node = e.target;
    const { x, y } = node.position();
    setObjects((prev) => prev.map((object) => {
      if (object.id !== objectId) return object;
      return { ...object, x, y };
    }));
    socket.emit('moveObjects', [objectId], { x, y });
  };

  const getObjectBounds = (object) => {
    if (object.type === 'stroke') {
      const points = getFlatPoints(object.points);
      const xs = points.filter((_, index) => index % 2 === 0);
      const ys = points.filter((_, index) => index % 2 === 1);
      const left = Math.min(...xs) - object.width / 2 - 4;
      const top = Math.min(...ys) - object.width / 2 - 4;
      const width = Math.max(...xs) - Math.min(...xs) + object.width + 8;
      const height = Math.max(...ys) - Math.min(...ys) + object.width + 8;
      return { left, top, width, height };
    }

    if (object.type === 'text') {
      const lines = (object.value || '').split('\n');
      const width = Math.max(...lines.map((line) => line.length * object.fontSize * 0.55));
      const height = lines.length * object.fontSize * 1.2 + 8;
      return { left: object.x - 4, top: object.y - 4, width, height };
    }

    return null;
  }

  const renderSelectionRect = (object) => {
    if (!object) return null;
    const { left, top, width, height } = getObjectBounds(object);
    return <Rect x={left} y={top} width={width} height={height} stroke="#0078d4" dash={[6, 4]} listening={false} />;
  };

  const renderHoverRect = (object) => {
    if (!object) return null;
    const { left, top, width, height } = getObjectBounds(object);
    return <Rect x={left} y={top} width={width} height={height} stroke="#0078d4" listening={false} />;
  };

  useEffect(() => {
    if (tool !== 'select') {
      setSelectedObjectIds([]);
    }
  }, [tool]);

  return (
    <div className="konva-canvas" style={{ position: 'relative', width: stageWidth, height: stageHeight }}>
      <Stage
        width={stageWidth}
        height={stageHeight}
        ref={stageRef}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onTouchStart={handleStageMouseDown}
        onTouchMove={handleStageMouseMove}
        onTouchEnd={handleStageMouseUp}
      >
        <Layer>
          {objects
            .filter((object) => !editingText || object.id !== editingText.id)
            .map((object) => {
              if (object.type === 'stroke') {
                return (
                  <Line
                    key={object.id}
                    points={getFlatPoints(object.points)}
                    stroke={object.color}
                    strokeWidth={object.width}
                    hitStrokeWidth={object.width + 10}
                    lineCap="round"
                    lineJoin="round"
                    tension={0.3}
                    draggable={tool === 'select' && selectedObjectIds.includes(object.id)}
                    onClick={(e) => handleObjectClick(object, e)}
                    onTap={(e) => handleObjectClick(object, e)}
                    onDragEnd={(e) => handleLineDragEnd(object.id, e)}
                    onMouseEnter={() => {
                      if (tool === 'select') {
                        setHoveredObjectId(object.id);
                      }
                    }}
                    onMouseLeave={() => setHoveredObjectId(null)}
                  />
                );
              }

              if (object.type === 'text') {
                return (
                  <Text
                    key={object.id}
                    text={object.value || ''}
                    x={object.x}
                    y={object.y}
                    fontSize={object.fontSize}
                    lineHeight={1.2}
                    fill={object.textColor}
                    draggable={tool === 'select' && selectedObjectIds.includes(object.id)}
                    onClick={(e) => handleObjectClick(object, e)}
                    onTap={(e) => handleObjectClick(object, e)}
                    onDblClick={() => {
                      if (tool === 'select') {
                        setSelectedObjectIds([]);
                        setHoveredObjectId(null);
                        setIsChangingText(true);
                        setEditingText({ ...object, y: object.y + object.fontSize * 0.5 });
                        setTool('text');
                      }
                    }}
                    onDragEnd={(e) => handleTextDragEnd(object.id, e)}
                    onMouseEnter={() => {
                      if (tool === 'select') {
                        setHoveredObjectId(object.id);
                      }
                    }}
                    onMouseLeave={() => setHoveredObjectId(null)}
                  />
                );
              }

              return null;
            })}

          {tool === 'select' && selectedObjectIds.map((id) => {
            const object = objects.find((item) => item.id === id);
            return renderSelectionRect(object);
          })}

          {hoveredObjectId && !editingText && !selectedObjectIds.includes(hoveredObjectId) && renderHoverRect(objects.find((item) => item.id === hoveredObjectId))}
        </Layer>
      </Stage>
    </div>
  );
}
