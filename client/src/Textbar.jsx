import './editbar.css';

export default function Textbar({ fontSize, setFontSize, textColor, setTextColor }) {
    return (
        <div className="editbar">
            <div className="edit-group">
                <label>Font Size:</label>
                <input
                    type="range"
                    min="1"
                    max="60"
                    value={fontSize}
                    onChange={(e) => setFontSize(e.target.value)}
                />
                <span>{fontSize}</span>
            </div>
            <div className="edit-group">
                <label>Color:</label>
                <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                />
            </div>
        </div>
    )
}