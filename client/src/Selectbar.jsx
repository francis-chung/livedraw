import './editbar.css';

export default function Selectbar({ selectedObjectIds, deleteObjects }) {
    return (
        <div className="editbar">
            {selectedObjectIds.length === 0 && (
                <h2>Select an object to move, edit or delete</h2>
            )}
            {selectedObjectIds.length > 0 && (
                <div className="edit-group">
                    <button className="delete" onClick={() => deleteObjects(selectedObjectIds)}>
                        Delete
                    </button>
                </div>
            )}
        </div>
    )
}