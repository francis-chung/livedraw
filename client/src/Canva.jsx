import { useRef, useEffect, useState } from 'react'
import { Stage, Layer, Line, Text, Rect, Group } from 'react-konva';
import socket from './socket.js';
import './app.css';
import { TextPath } from 'konva/lib/shapes/TextPath';
import { Path } from 'konva/lib/shapes/Path';

export default function Canvas({ stageRef, tool, setTool, color, brushSize, fontSize, textColor, objects, setObjects, selectedObjectIds, setSelectedObjectIds, hoveredObjectId, setHoveredObjectId, editingText, setEditingText, setIsChangingText }) {
  const groupRef = useRef(null);
  const isDrawing = useRef(false);
  const currentStrokeId = useRef(null);
  const isSelecting = useRef(false);
  const selectionStart = useRef(null);
  const selectionRect = useRef(null);
  const dragStartPos = useRef(null);
  const [selectionBox, setSelectionBox] = useState(null);

  const stageWidth = 800;
  const stageHeight = 600;

  const getFlatPoints = (points) => points.flatMap((point) => [point.x, point.y]);

  const getObjectBounds = (object) => {
    if (object.type === 'stroke') {
      const points = getFlatPoints(object.points);
      const xs = points.filter((_, index) => index % 2 === 0);
      const ys = points.filter((_, index) => index % 2 === 1);
      const left = Math.min(...xs) - object.width / 2 - 4;
      const top = Math.min(...ys) - object.width / 2 - 4;
      const width = Math.max(...xs) - Math.min(...xs) + object.width + 8;
      const height = Math.max(...ys) - Math.min(...ys) + object.width + 8;
      return { x: left, y: top, width, height };
    }

    if (object.type === 'text') {
      const lines = (object.value || '').split('\n');
      const width = Math.max(...lines.map((line) => line.length * object.fontSize * 0.55));
      const height = lines.length * object.fontSize * 1.2 + 8;
      return { x: object.x - 4, y: object.y - 4, width, height };
    }

    return null;
  };

  const haveIntersection = (obj1, obj2) => {
    return !(
      obj1.x > obj2.x + obj2.width ||
      obj1.x + obj1.width < obj2.x ||
      obj1.y > obj2.y + obj2.height ||
      obj1.y + obj1.height < obj2.y
    );
  };

  const renderSelectionRect = (object) => {
    if (!object) return null;
    const { x, y, width, height } = getObjectBounds(object);
    return <Rect key={object.id} x={x} y={y} width={width} height={height} stroke="#0078d4" dash={[6, 4]} listening={false} />;
  };

  const renderHoverRect = (object) => {
    if (!object) return null;
    const { x, y, width, height } = getObjectBounds(object);
    return <Rect key={object.id} x={x} y={y} width={width} height={height} stroke="#0078d4" listening={false} />;
  };

  const handleStageMouseDown = (e) => {
    const clickedOnEmpty = e.target === e.target.getStage();
    if (!clickedOnEmpty) return;

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
        points: [pointerPos],
      };
      setObjects((prev) => [...prev, stroke]);
      currentStrokeId.current = stroke.id;
      setSelectedObjectIds([]);
    } else if (tool === 'select') {
      isSelecting.current = true;
      selectionStart.current = pointerPos;
      selectionRect.current = { x, y, width: 0, height: 0 };
    } else if (tool === 'text') {
      setTimeout(() => {
        setEditingText({
          id: crypto.randomUUID(),
          type: 'text',
          x,
          y,
          value: '',
          textColor,
          fontSize,
        });
      }, 0);
    }
  };

  const handleStageMouseMove = (e) => {
    const stage = e.target.getStage();
    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;
    const { x, y } = pointerPos;

    if (tool === 'draw' && isDrawing.current) {
      setObjects((prev) => prev.map((object) => {
        if (object.id !== currentStrokeId.current) return object;
        return { ...object, points: [...object.points, { x, y }] };
      }));
    } else if (tool === 'select' && isSelecting.current) {
      const start = selectionStart.current;
      selectionRect.current = {
        x: Math.min(start.x, x),
        y: Math.min(start.y, y),
        width: Math.abs(x - start.x),
        height: Math.abs(y - start.y)
      };
      setSelectionBox({ ...selectionRect.current });
    }
  };

  const handleStageMouseUp = () => {
    if (isDrawing.current) {
      isDrawing.current = false;
      currentStrokeId.current = null;
    } else if (isSelecting.current) {
      const box = selectionRect.current;
      const selected = objects.filter((obj) => {
        const objBox = getObjectBounds(obj);
        return haveIntersection(objBox, box);
      });
      setSelectedObjectIds(selected.map(obj => obj.id));
      isSelecting.current = false;
      selectionRect.current = null;
      setSelectionBox(null);
    }
  };

  const handleObjectClick = (object, e) => {
    if (tool === 'select') {
      setSelectedObjectIds([object.id]);
      e.cancelBubble = true;
    }
  };

  const handleGroupDragEnd = (e) => {
    const { x, y } = e.target.position();

    setObjects(prev =>
      prev.map(obj => {
        if (!selectedObjectIds.includes(obj.id)) return obj;
        if (obj.type === 'stroke') {
          return {
            ...obj,
            points: obj.points.map(p => ({
              x: p.x + x,
              y: p.y + y
            }))
          };
        } else if (obj.type === 'text') {
          return {
            ...obj,
            x: obj.x + x,
            y: obj.y + y
          };
        }
      })
    );

    socket.emit('moveObjects', [selectedObjectIds], { x, y });
    e.target.position({ x: 0, y: 0 });
  };

  const renderObject = (object) => {
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
          onClick={(e) => handleObjectClick(object, e)}
          onTap={(e) => handleObjectClick(object, e)}
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
          // draggable={tool === 'select' && selectedObjectIds.includes(object.id)}
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
          // onDragEnd={(e) => handleTextDragEnd(object.id, e)}
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
  }

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
            .filter((object) => !selectedObjectIds.includes(object.id) && (!editingText || object.id !== editingText.id))
            .map(renderObject)}

          {selectedObjectIds.length > 0 && (
            <Group
              draggable
              ref={groupRef}
              onDragMove={() => console.log("to add: move")}
              onDragEnd={handleGroupDragEnd}
            >
              {objects.filter(obj => selectedObjectIds.includes(obj.id)).map(renderObject)}
            </Group>
          )}

          {tool === 'select' && selectedObjectIds.map((id) => {
            const object = objects.find((item) => item.id === id);
            return renderSelectionRect(object);
          })}

          {hoveredObjectId && !editingText && !selectedObjectIds.includes(hoveredObjectId) && renderHoverRect(objects.find((item) => item.id === hoveredObjectId))}

          {selectionBox && (
            <Rect
              x={selectionBox.x}
              y={selectionBox.y}
              width={selectionBox.width}
              height={selectionBox.height}
              stroke="#8ebde0"
              listening={false}
            />
          )}
        </Layer>
      </Stage>
    </div>
  );
}
