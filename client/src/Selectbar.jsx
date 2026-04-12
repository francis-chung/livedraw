import './editbar.css';

export default function Selectbar({ selectedObjectId, deleteObject }) {
    return (
        <div className="editbar">
            {!selectedObjectId && (
                <h2>Select an object</h2>
            )}
            {selectedObjectId && (
                <div className="edit-group">
                    <button className="delete" onClick={() => deleteObject(selectedObjectId)}>
                        Delete
                    </button>
                </div>
            )}
        </div>
    )
}