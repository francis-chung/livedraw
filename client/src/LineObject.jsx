import { Line } from 'react-konva'

export default function LineObject({ object, getFlatPoints, handleObjectClick, setHoveredObjectIds, tool }) {
    return (
        <Line
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