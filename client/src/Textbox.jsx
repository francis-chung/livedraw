import { useRef, useEffect } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import socket from './socket.js';
import './editbar.css';

export default function Textbox({ objects, setObjects, editingText, setEditingText, isChangingText, setIsChangingText, interactingWithTextbar }) {
    // padding to ensure textbox stays on canvas in the right position
    // also to ensure proper rendering after saving editing text      
    const paddingX = 21;
    const paddingY = 20;
    const ref = useRef(null);

    // only saves textbox and deactivates textarea when not interacting with textbar
    const handleBlur = () => {
        if (!interactingWithTextbar) {
            // ensures a non-empty value is in the textarea in order to save
            const trimmed = editingText.value.trim();
            if (trimmed) {
                const editedText = { ...editingText, value: trimmed };
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


    // fontSize factor in top property of style also required for padding
    // TextareaAutosize has built-in functions to autosize the textarea
    return (
        <TextareaAutosize
            ref={ref}
            className="textbox-container"
            style={{
                position: "absolute",
                left: editingText.x + paddingX,
                top: editingText.y - 0.9 * editingText.fontSize + paddingY,
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