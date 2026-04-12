import './editbar.css';

export default function Drawbar({ color, setColor, brushSize, setBrushSize }) {
    return (
        <div className="drawbar">
            <div className="draw-group">
                <label>Color:</label>
                <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                />
            </div>
            <div className="draw-group">
                <label>Brush Size:</label>
                <input
                    type="range"
                    min="1"
                    max="20"
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                />
                <span>{brushSize}px</span>
            </div>
        </div>
    )
}