import { useRef } from 'react';
import './editbar.css';

export default function Textbox({ texts, setTexts, editingText, setEditingText }) {
    const padding = 20; // matches .canvas-container padding
    const ref = useRef(null);

    return (
        <textarea
            ref={ref}
            className="textbox-container"
            style={{
                position: "absolute",
                left: editingText.x + padding,
                top: editingText.y + padding,
                color: "black"
            }}
            autoFocus
            value={editingText.value || ""}
            onChange={(e) => {
                setEditingText({ ...editingText, value: e.target.value })
            }}
            onBlur={() => {
                console.log("done already???");
                setTexts([...texts, editingText]);
                setEditingText(null);
            }}
        />
    )
}