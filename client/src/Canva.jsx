import { useRef, useEffect, useState } from 'react'
import { Stage, Layer, Line, Text, Rect, Group } from 'react-konva';
import socket from './socket.js';
import './app.css';
import { TextPath } from 'konva/lib/shapes/TextPath';
import { Path } from 'konva/lib/shapes/Path';
import LineObject from './LineObject.jsx';
import TextObject from './TextObject.jsx';

export default function Canvas({ stageRef, tool, setTool, color, brushSize, fontSize, textColor, lineSize, lineColor, objects, setObjects, selectedObjectIds, setSelectedObjectIds, hoveredObjectIds, setHoveredObjectIds, editingText, setEditingText, setIsChangingText }) {
  // useRef: similar to useState, but does not cause a screen re-render
  // only for when data not shown on-screen is modified   
  const groupRef = useRef(null);
  const isDrawing = useRef(false);
  const drawStart = useRef(null);
  const currentStrokeId = useRef(null);
  const isSelecting = useRef(false);
  const selectionStart = useRef(null);
  const isDragging = useRef(false);
  const dragStart = useRef(null);
  const isLining = useRef(null);
  const lineStart = useRef(null);
  const [selectionBox, setSelectionBox] = useState(null);
  const [dragPos, setDragPos] = useState(null);

  const stageWidth = 800;
  const stageHeight = 600;

  // flattens points array by one level => [x1, y1, x2, y2...]
  // necessary for Konva line points format
  const getFlatPoints = (obj) => {
    return obj.points.flatMap(p => [p.x + obj.x, p.y + obj.y]);
  };

  // creates bounding boxes for any type of object
  const getObjectBounds = (object) => {
    if (object.type === 'stroke' || object.type === 'line') {
      const points = getFlatPoints(object);
      // processes flat points based on even/odd index positions
      const xs = points.filter((_, index) => index % 2 === 0);
      const ys = points.filter((_, index) => index % 2 === 1);

      // finds extremum value, then accounts for thickness of 
      // stroke (strokes are drawn centered on path) and safety margin
      const left = Math.min(...xs) - object.width / 2 - 4;
      const top = Math.min(...ys) - object.width / 2 - 4;
      const width = Math.max(...xs) - Math.min(...xs) + object.width + 8;
      const height = Math.max(...ys) - Math.min(...ys) + object.width + 8;

      return { x: left, y: top, width, height };
    }

    if (object.type === 'text') {
      const lines = (object.value || '').split('\n');

      // approximates width based on font size of textbox
      const width = Math.max(...lines.map((line) => line.length * object.fontSize * 0.55));
      const height = lines.length * object.fontSize * 1.2 + 8;

      // accounts for padding
      return { x: object.x - 4, y: object.y - 4, width, height };
    }

    return null;
  };

  // checks if two objects' bounding boxes intersect
  // precondition: obj1 and obj2 are in the form {x, y, width, height}
  const haveIntersection = (obj1, obj2) => {
    return !(
      obj1.x > obj2.x + obj2.width ||
      obj1.x + obj1.width < obj2.x ||
      obj1.y > obj2.y + obj2.height ||
      obj1.y + obj1.height < obj2.y
    );
  };

  // renders selection, hover and marquee rectangles
  // optionally add a displacement vector when selected objects are dragged 
  const renderSelectionRect = (object, select, marquee, dx = 0, dy = 0) => {
    if (!object) return null;
    // box-type objects are already in the correct format
    const { x, y, width, height } = (object.type === 'box' ? object : getObjectBounds(object));

    // conditions available based on type of selection box
    // dash: 6px drawn, 4px gap
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

  // renders bounding boxes for selected objects, with optional parameter when dragging
  const renderSelectionsRect = (drag = false) => {
    return selectedObjectIds.map((id) => {
      const object = objects.find((item) => item.id === id);
      return renderSelectionRect(object, true, false, drag ? dragPos.x : 0, drag ? dragPos.y : 0);
    });
  };

  // renders bounding box for hovered objects
  const renderHoverRect = () => {
    return objects
      .filter(obj => hoveredObjectIds.includes(obj.id))
      .map(obj => renderSelectionRect(obj, false, false));
  };

  // renders bounding box of marquee select
  // creates a box-typed object to fit helper function parameters
  const renderMarqueeRect = () => {
    const box = { ...selectionBox, type: 'box' };
    return renderSelectionRect(box, false, true);
  };

  // redir: when an object is clicked but no interaction with it is expected
  const handleStageMouseDown = (e, redir = false) => {
    // ensures the stage is clicked, not any other object on top of it    
    const clickedOnEmpty = e.target === e.target.getStage();
    if (!clickedOnEmpty && !redir) return;

    const stage = e.target.getStage();
    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;
    const { x, y } = pointerPos;

    if (tool === 'draw') {
      isDrawing.current = true;
      // format: (x, y): coordinates of first point in stroke
      // points: coordinates of points relative to first point in stroke
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
      // NOTE: redundant because stroke.x and stroke.y store the same thing
      drawStart.current = { x, y };
    } else if (tool === 'select') {
      setSelectedObjectIds([]);

      // assumes marquee select until mouseUp
      isSelecting.current = true;
      selectionStart.current = pointerPos;
      setSelectionBox({ x, y, width: 0, height: 0 });
    } else if (tool === 'text') {
      // setTimeout() required so clicking on stage doesn't focus 
      // on stage again and trigger onBlur() after initially creating textbox         
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
    } else if (tool === 'line') {
      if (!isLining.current) {
        isLining.current = true;
        const line = {
          id: crypto.randomUUID(),
          type: 'line',
          x,
          y,
          color: lineColor,
          width: lineSize,
          points: [{ x: 0, y: 0 }]
        }
        setObjects((prev) => [...prev, line]);
        currentStrokeId.current = line.id;
        lineStart.current = { x, y };
      }
    }
  };

  const handleStageMouseMove = (e) => {
    const stage = e.target.getStage();
    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;
    const { x, y } = pointerPos;

    // adds new point in current stroke
    if (tool === 'draw' && isDrawing.current) {
      const { x: startX, y: startY } = drawStart.current;

      // only changes the stroke corresponding to the right object
      setObjects((prev) => prev.map((object) => {
        if (object.id !== currentStrokeId.current) return object;
        // ensures coordinates of points are relative to position of first point in stroke
        return { ...object, points: [...object.points, { x: x - startX, y: y - startY }] };
      }));
    } else if (tool === 'select' && isSelecting.current) {
      const start = selectionStart.current;

      // adjusts selectionBox data to ensure proper rendering based on new coordinates
      setSelectionBox({
        x: Math.min(start.x, x),
        y: Math.min(start.y, y),
        width: Math.abs(x - start.x),
        height: Math.abs(y - start.y)
      });

      // sets all objects the selectionBox is "over" to hovered, to indicate elements to be selected
      setHoveredObjectIds(objects
        .filter(obj => haveIntersection(getObjectBounds(obj), selectionBox))
        .map(obj => obj.id)
      );
    } else if (tool === 'line' && isLining.current) {
      const { x: startX, y: startY } = lineStart.current;
      setObjects((prev) => prev.map((obj) => {
        if (obj.id !== currentStrokeId.current) return obj;
        return { ...obj, points: [{ x: 0, y: 0 }, { x: x - startX, y: y - startY }] };
      }))
    }
  };

  const handleStageMouseUp = () => {
    if (isDrawing.current) {
      const stroke = objects.find(obj => obj.id === currentStrokeId.current);

      // terminate stroke and send to server
      socket.emit('addObject', stroke);
      isDrawing.current = false;
      currentStrokeId.current = null;
    } else if (isSelecting.current) {
      // condition prevents clicking without dragging from invoking selection
      if (selectionBox.width || selectionBox.height) {
        // sets all objects the selectionBox is "over" to selected
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
      setHoveredObjectIds([]);
    } else if (tool === 'line' && object.id === currentStrokeId.current) {
      const line = objects.find(obj => obj.id === currentStrokeId.current);
      socket.emit('addObject', line);
      isLining.current = false;
      currentStrokeId.current = null;
    } else { // automatically redirects to clicking the stage
      handleStageMouseDown(e, true);
    }
  };

  const handleGroupDragStart = (e) => {
    isDragging.current = true;
    dragStart.current = e.target.position();
  };

  const handleGroupDragMove = (e) => {
    const { x, y } = e.target.position();
    // triggers re-renders of selected object boxes with corresponding offsets 
    setDragPos(e.target.position());
  };

  const handleGroupDragEnd = (e) => {
    isDragging.current = false;
    const { x, y } = e.target.position();

    // changes coordinates of objects after moving, then sends to server
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

    socket.emit('moveObjects', selectedObjectIds, { x, y });
    e.target.position({ x: 0, y: 0 });
    setDragPos({ x: 0, y: 0 });
  };

  const renderObject = (object) => {
    if (object.type === 'stroke' || object.type === 'line') {
      return (
        <LineObject
          key={object.id}
          object={object}
          getFlatPoints={getFlatPoints}
          handleObjectClick={handleObjectClick}
          setHoveredObjectIds={setHoveredObjectIds}
          tool={tool}
          fadedOpacity={isLining.current && object.id === currentStrokeId.current}
        />
      );
    }

    if (object.type === 'text') {
      return (
        <TextObject
          key={object.id}
          object={object}
          handleObjectClick={handleObjectClick}
          setSelectedObjectIds={setSelectedObjectIds}
          setHoveredObjectIds={setHoveredObjectIds}
          setIsChangingText={setIsChangingText}
          setEditingText={setEditingText}
          tool={tool}
          setTool={setTool}
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

  // unselected objects are rendered separately from selected ones
  // selected objects are grouped into a Group to simplify modifications made to it
  // hovered objects' boxes are only rendered when object is not a selected object
  // (only one object may be hovered at once in this scenario)
  // !editingText condition for hovered objects patches bug during transition 
  // from select to edit text
  return (
    <div className="konva-canvas" style={{ position: 'relative', width: stageWidth, height: stageHeight }}>
      <Stage
        width={stageWidth}
        height={stageHeight}
        ref={stageRef}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onMouseLeave={handleStageMouseUp}
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
