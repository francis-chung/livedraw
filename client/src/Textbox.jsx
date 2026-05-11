import { useState, useRef, useEffect } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import socket from './socket.js';
import './editbar.css';

export default function Textbox({ stageBox, objects, setObjects, editingText, setEditingText, isChangingText, setIsChangingText, interactingWithTextbar }) {
    const measureRef = useRef(null);
    const [textboxWidth, setTextboxWidth] = useState(0);

    const handleBlur = () => {
        if (!interactingWithTextbar) {
            const trimmed = editingText.value.trim();
            if (trimmed) {
                const editedText = { ...editingText, value: trimmed, y: editingText.y - editingText.fontSize * 0.5 };
                if (!isChangingText) {
                    setObjects([...objects, editedText]);
                    socket.emit('addObject', editedText);
                } else {
                    setObjects(prev => prev.map(obj =>
                        obj.id === editedText.id ? editedText : obj
                    ));
                    socket.emit('updateObjects', [editedText]);
                }
            }
            setEditingText(null);
            setIsChangingText(false);
        }
    }

    useEffect(() => {
        if (!interactingWithTextbar) {
            document.querySelector('.textbox-container').focus();
        }
    }, [interactingWithTextbar]);

    useEffect(() => {
        if (!measureRef.current) return;

        const width = measureRef.current.scrollWidth;
        setTextboxWidth(width + editingText.fontSize);
    }, [editingText.value, editingText.fontSize]);

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
                    color: editingText.color
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