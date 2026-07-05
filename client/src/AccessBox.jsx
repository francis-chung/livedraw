import './accessBox.css';

export default function AccessBox({ canvasAccessMode, setCanvasAccessMode, currentCanvasRole }) {
    return (
        <div className="access-box-container">
            <div className="access-switcher">
                <label className="canvas-mode-label" htmlFor="canvas-access-mode">Mode:</label>
                <select
                    id="canvas-access-mode"
                    value={canvasAccessMode}
                    onChange={(event) => setCanvasAccessMode(event.target.value)}
                    disabled={currentCanvasRole === 'viewer'}
                >
                    <option value="edit">Edit</option>
                    <option value="view">View</option>
                </select>
            </div>
        </div>
    )
}