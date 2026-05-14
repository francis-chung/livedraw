import './editbar.css';

export default function Selectbar({ selectedObjectIds, deleteObjects, editColor, setEditColor, multipleColors, setMultipleColors }) {
    return (
        <div className="editbar">
            {selectedObjectIds.length === 0 ? (
                <h2>Select an object to move, edit or delete</h2>
            ) : (
                <>
                    <div className="edit-group color-wrapper">
                        <label>Color:</label>
                        <div className="color-wrapper">
                            <input
                                type="color"
                                value={editColor}
                                onChange={(e) => {
                                    setEditColor(e.target.value);
                                    setMultipleColors(false);
                                }}
                            />
                            {multipleColors && <div className="multiple-colors" />}
                        </div>
                    </div>
                    <div className="edit-group">
                        <button className="delete" onClick={() => deleteObjects(selectedObjectIds)}>
                            Delete
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}