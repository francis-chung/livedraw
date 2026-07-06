import './toolbar.css';
import PencilIcon from '@iconify-react/mdi/pencil';
import MouseIcon from '@iconify-react/material-symbols/mouse';
import TextIcon from '@iconify-react/mdi/text';
import LineSegmentIcon from '@iconify-react/ph/line-segment';
import TrashIcon from '@iconify-react/mdi/trash';
import SaveIcon from '@iconify-react/material-symbols/save';

export default function Toolbar({ tool, setTool, handleClear, handleSave }) {
    return (
        <div className="toolbar">
            <button className={tool === "draw" ? "active" : ""}
                onClick={() => setTool("draw")}>
                <PencilIcon height="1.5em" />
            </button>
            <button className={tool === "select" ? "active" : ""}
                onClick={() => setTool("select")}>
                <MouseIcon height="1.5em" />
            </button>
            <button className={tool === "text" ? "active" : ""}
                onClick={() => setTool("text")}>
                <TextIcon height="1.5em" />
            </button>
            <button className={tool === "line" ? "active" : ""}
                onClick={() => setTool("line")}>
                <LineSegmentIcon height="1.5em" />
            </button>
            <button className="clear"
                onClick={handleClear}>
                <TrashIcon height="1.5em" />
            </button>
            <button className="save"
                onClick={() => handleSave(false, true)}>
                <SaveIcon height="1.5em" />
            </button>
        </div>
    );
}