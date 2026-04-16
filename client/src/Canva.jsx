import { useRef, useEffect, useState } from 'react'
import { Stage, Layer, Line, Text, Rect, Group } from 'react-konva';
import socket from './socket.js';
import './app.css';
import { TextPath } from 'konva/lib/shapes/TextPath';
import { Path } from 'konva/lib/shapes/Path';

export default function Canvas({ stageRef, tool, setTool, color, brushSize, fontSize, textColor, objects, setObjects, selectedObjectIds, setSelectedObjectIds, hoveredObjectIds, setHoveredObjectIds, editingText, setEditingText, setIsChangingText }) {
  const groupRef = useRef(null);
  const isDrawing = useRef(false);
  const drawStart = useRef(null);
  const currentStrokeId = useRef(null);
  const isSelecting = useRef(false);
  const selectionStart = useRef(null);
  const isDragging = useRef(false);
  const dragStart = useRef(null);
  const [selectionBox, setSelectionBox] = useState(null);
  const [dragPos, setDragPos] = useState(null);

  const stageWidth = 800;
  const stageHeight = 600;

  const getFlatPoints = (obj) => {
    return obj.points.flatMap(p => [p.x + obj.x, p.y + obj.y]);
  };

  const getObjectBounds = (object) => {
    if (object.type === 'stroke') {
      const points = getFlatPoints(object);
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

  const renderSelectionRect = (object, select, marquee, dx = 0, dy = 0) => {
    if (!object) return null;
    const { x, y, width, height } = (object.type === 'box' ? object : getObjectBounds(object));
    return <Rect
      key={object.id}
      x={x + dx}
      y={y + dy}
      width={width}
      height={height}
      stroke={marquee ? "#8ebde0" : "#0078d4"}
      dash={select ? [6, 4] : [1, 0]}
      listening={false}
    />;
  };

  const renderSelectionsRect = (drag = false) => {
    return selectedObjectIds.map((id) => {
      const object = objects.find((item) => item.id === id);
      return renderSelectionRect(object, true, false, drag ? dragPos.x : 0, drag ? dragPos.y : 0);
    });
  };

  const renderHoverRect = () => {
    return objects
      .filter(obj => hoveredObjectIds.includes(obj.id))
      .map(obj => renderSelectionRect(obj, false, false));
  };

  const renderMarqueeRect = () => {
    const box = { ...selectionBox, type: 'box' };
    return renderSelectionRect(box, false, true);
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
        x,
        y,
        color,
        width: brushSize,
        points: [{ x: 0, y: 0 }],
      };
      setObjects((prev) => [...prev, stroke]);
      currentStrokeId.current = stroke.id;
      drawStart.current = { x, y };
    } else if (tool === 'select') {
      setSelectedObjectIds([]);
      isSelecting.current = true;
      selectionStart.current = pointerPos;
      setSelectionBox({ x, y, width: 0, height: 0 });
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
      const { x: startX, y: startY } = drawStart.current;
      setObjects((prev) => prev.map((object) => {
        if (object.id !== currentStrokeId.current) return object;
        return { ...object, points: [...object.points, { x: x - startX, y: y - startY }] };
      }));
    } else if (tool === 'select' && isSelecting.current) {
      const start = selectionStart.current;
      setSelectionBox({
        x: Math.min(start.x, x),
        y: Math.min(start.y, y),
        width: Math.abs(x - start.x),
        height: Math.abs(y - start.y)
      });
      setHoveredObjectIds(objects
        .filter(obj => haveIntersection(getObjectBounds(obj), selectionBox))
        .map(obj => obj.id)
      );
    }
  };

  const handleStageMouseUp = () => {
    if (isDrawing.current) {
      isDrawing.current = false;
      currentStrokeId.current = null;
    } else if (isSelecting.current) {
      if (selectionBox.width || selectionBox.height) {
        const selected = objects.filter((obj) => {
          const objBox = getObjectBounds(obj);
          return haveIntersection(objBox, selectionBox);
        });
        setSelectedObjectIds(selected.map(obj => obj.id));
      }
      isSelecting.current = false;
      setSelectionBox(null);
    }
  };

  const handleObjectClick = (object, e) => {
    if (tool === 'select') {
      setSelectedObjectIds([object.id]);
      e.cancelBubble = true;
    }
  };

  const handleGroupDragStart = (e) => {
    isDragging.current = true;
    dragStart.current = e.target.position();
  };

  const handleGroupDragMove = (e) => {
    const { x, y } = e.target.position();
    setDragPos(e.target.position());
  };

  const handleGroupDragEnd = (e) => {
    isDragging.current = false;
    const { x, y } = e.target.position();

    setObjects(prev =>
      prev.map(obj => {
        if (!selectedObjectIds.includes(obj.id)) return obj;
        return {
          ...obj,
          x: obj.x + x,
          y: obj.y + y
        };
      })
    );

    socket.emit('moveObjects', [selectedObjectIds], { x, y });
    e.target.position({ x: 0, y: 0 });
    setDragPos({ x: 0, y: 0 });
  };

  const renderObject = (object) => {
    if (object.type === 'stroke') {
      return (
        <Line
          key={object.id}
          points={getFlatPoints(object)}
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
              setHoveredObjectIds([object.id]);
            }
          }}
          onMouseLeave={() => setHoveredObjectIds([])}
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
          onClick={(e) => handleObjectClick(object, e)}
          onTap={(e) => handleObjectClick(object, e)}
          onDblClick={() => {
            if (tool === 'select') {
              setSelectedObjectIds([]);
              setHoveredObjectIds([]);
              setIsChangingText(true);
              setEditingText({ ...object, y: object.y + object.fontSize * 0.5 });
              setTool('text');
            }
          }}
          onMouseEnter={() => {
            if (tool === 'select') {
              setHoveredObjectIds([object.id]);
            }
          }}
          onMouseLeave={() => setHoveredObjectIds([])}
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
              onDragStart={handleGroupDragStart}
              onDragMove={handleGroupDragMove}
              onDragEnd={handleGroupDragEnd}
            >
              {objects.filter(obj => selectedObjectIds.includes(obj.id)).map(renderObject)}
            </Group>
          )}

          {tool === 'select' && !isDragging.current && renderSelectionsRect()}
          {isDragging.current && renderSelectionsRect(true)}
          {hoveredObjectIds && !editingText
            && !selectedObjectIds.includes(hoveredObjectIds[0]) && renderHoverRect()}
          {selectionBox && renderMarqueeRect()}
        </Layer>
      </Stage>
    </div>
  );
}
