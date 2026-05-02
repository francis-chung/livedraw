import LineObject from './LineObject.jsx';
import TextObject from './TextObject.jsx';

export function getFlatPoints(obj) {
    return obj.points.flatMap(p => [p.x + obj.x, p.y + obj.y]);
};

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