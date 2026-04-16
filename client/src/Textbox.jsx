import { useState, useRef, useEffect } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import socket from './socket.js';
import './editbar.css';

export default function Textbox({ stageBox, objects, setObjects, editingText, setEditingText, isChangingText, setIsChangingText, interactingWithTextbar }) {
    // directly accesses properties of the span, e.g. scrollWidth
    const measureRef = useRef(null);
    const [textboxWidth, setTextboxWidth] = useState(0);

    // only saves textbox and deactivates textarea when not interacting with textbar
    const handleBlur = () => {
        if (!interactingWithTextbar) {
            // ensures a non-empty value is in the textarea in order to save
            const trimmed = editingText.value.trim();
            if (trimmed) {
                // fontSize offset necessary for proper display (and due to Konva misalignment)
                const editedText = { ...editingText, value: trimmed, y: editingText.y - editingText.fontSize * 0.5 };
                if (!isChangingText) { // for adding a new text object
                    setObjects([...objects, editedText]);
                    socket.emit('addObject', editedText);
                } else { // for modifying a previously existing text object
                    setObjects(prev => prev.map(obj =>
                        obj.id === editedText.id ? editedText : obj
                    ));
                    socket.emit('updateObject', editedText);
                }
            }
            setEditingText(null);
            setIsChangingText(false);
        }
    }

    // refocuses textarea every time mouse leaves textbar to facilitate saving
    useEffect(() => {
        if (!interactingWithTextbar) {
            document.querySelector('.textbox-container').focus();
        }
    }, [interactingWithTextbar]);

    // determines approximate width of textbox through span 
    // this is to ensure clicks to the right of the textbox successfully unfocus it
    useEffect(() => {
        if (!measureRef.current) return;

        const width = measureRef.current.scrollWidth;
        // fontSize offset to ensure enough space is given for the next character
        setTextboxWidth(width + editingText.fontSize);
    }, [editingText.value, editingText.fontSize]);

    // stageBox offsets to convert canvas coordinates to DOM coordinates
    // fontSize factor in top property of style also required for adjustments due to Konva
    // TextareaAutosize has built-in functions to autosize the textarea
    // span used to measure width of textbox for better UX when clicking out of it
    return (
        <div>
            <TextareaAutosize
                className="textbox-container"
                style={{
                    position: "absolute",
                    left: stageBox.left + editingText.x,
                    top: stageBox.top + editingText.y - editingText.fontSize * 0.5,
                    width: textboxWidth,
                    fontSize: editingText.fontSize,
                    fontFamily: "Arial",
                    lineHeight: 1.2,
                    color: editingText.textColor
                }}
                autoFocus
                value={editingText.value || ""}
                onChange={(e) => {
                    setEditingText({ ...editingText, value: e.target.value })
                }}
                onBlur={handleBlur}
            />
            <span
                ref={measureRef}
                style={{
                    position: "absolute",
                    visibility: "hidden",
                    fontSize: editingText.fontSize,
                    fontFamily: "Arial"
                }}
            >
                {editingText.value || " "}
            </span>
        </div>
    )
}