import './toolbar.css';

export default function Toolbar({ tool, setTool, handleClear }) {
    return (
        <div className="toolbar">
            <button className={tool === "draw" ? "active" : ""}
                onClick={() => setTool("draw")}>
                ✏️
            </button>
            <button className={tool === "select" ? "active" : ""}
                onClick={() => setTool("select")}>
                🖱️
            </button>
            <button className={tool === "text" ? "active" : ""}
                onClick={() => setTool("text")}>
                T
            </button>
            <button className="clear"
                onClick={handleClear}>
                🗑️
            </button>
        </div>
    );
}