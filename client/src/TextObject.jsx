import { Text } from 'react-konva'

export default function TextObject({ object, handleObjectClick, setSelectedObjectIds, setHoveredObjectIds, setIsChangingText, setEditingText, tool, setTool }) {
    return (
        <Text
            text={object.value || ''}
            x={object.x}
            y={object.y}
            fontSize={object.fontSize}
            lineHeight={1.2}
            fill={object.color}
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