import LineObject from './LineObject.jsx';
import TextObject from './TextObject.jsx';

// flattens points array by one level => [x1, y1, x2, y2...]
// necessary for Konva line points format
export function getFlatPoints(obj) {
    return obj.points.flatMap(p => [p.x + obj.x, p.y + obj.y]);
};

// function has object acting as a regular parameter and all 
// others like props
// default values are set for when gallery displays 
// non-interactable miniature versions of each canvas
export function renderObject({
    object,
    tool = null,
    setTool = () => { },
    handleObjectClick = () => { },
    setSelectedObjectIds = () => { },
    setHoveredObjectIds = () => { },
    setIsChangingText = () => { },
    setEditingText = () => { },
    isLining = { current: false },
    currentStrokeId = { current: null } }) {
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