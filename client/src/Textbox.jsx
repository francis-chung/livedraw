import { useRef } from 'react';
import socket from './socket.js';
import './editbar.css';

export default function Textbox({ objects, setObjects, editingText, setEditingText }) {
    // padding to ensure textbox stays on canvas in the right position
    // also to ensure proper rendering after saving editing text
    const paddingX = 16;
    const paddingY = 1;
    const ref = useRef(null);

    return (
        <textarea
            ref={ref}
            className="textbox-container"
            style={{
                position: "absolute",
                left: editingText.x + paddingX,
                top: editingText.y + paddingY,
                color: "black"
            }}
            autoFocus
            value={editingText.value || ""}
            onChange={(e) => {
                setEditingText({ ...editingText, value: e.target.value })
            }}
            onBlur={() => {
                setObjects([...objects, editingText]);
                socket.emit('addObject', editingText);
                setEditingText(null);
            }}
        />
    )
}