import { useRef, useEffect } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import socket from './socket.js';
import './editbar.css';

export default function Textbox({ stageBox, objects, setObjects, editingText, setEditingText, isChangingText, setIsChangingText, interactingWithTextbar }) {
    const handleBlur = () => {
        if (!interactingWithTextbar) {
            const trimmed = editingText.value.trim();
            if (trimmed) {
                const editedText = { ...editingText, value: trimmed };
                if (!isChangingText) {
                    setObjects([...objects, editedText]);
                    socket.emit('addObject', editedText);
                } else {
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

    useEffect(() => {
        if (!interactingWithTextbar) {
            document.querySelector('.textbox-container').focus();
        }
    }, [interactingWithTextbar]);

    return (
        <TextareaAutosize
            className="textbox-container"
            style={{
                position: "absolute",
                left: stageBox.left + editingText.x,
                top: stageBox.top + editingText.y,
                font: `${editingText.fontSize}px Arial`,
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
    )
}