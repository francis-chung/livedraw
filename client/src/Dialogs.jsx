import './dialogs.css';

export function ConfirmSignOut({ handleCancelSignOut, handleConfirmSignOut }) {
    return (
        <div className="modal-backdrop" onClick={handleCancelSignOut}>
            <div className="modal confirm-modal" role="dialog" aria-modal="true" aria-labelledby="signout-title" onClick={(e) => e.stopPropagation()}>
                <h2 id="signout-title">Are you sure?</h2>
                <p>Signing out will end your session and disconnect you from Livedraw.</p>
                <div className="modal-actions">
                    <button className="modal-button cancel" onClick={handleCancelSignOut}>Cancel</button>
                    <button className="modal-button confirm" onClick={handleConfirmSignOut}>Sign out</button>
                </div>
            </div>
        </div>
    )
}