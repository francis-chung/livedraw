import { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import './sidebarMenu.css';
import DarkMode from './DarkMode.jsx';

const SidebarMenu = forwardRef(function SidebarMenu({ user, onGalleryClick, onSignOutRequest, currentView, onShareCanvas }, ref) {
    const [isOpen, setIsOpen] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [shareUserId, setShareUserId] = useState('');
    const [shareRole, setShareRole] = useState('viewer');

    const handleShareClick = () => {
        if (!shareUserId.trim()) {
            return;
        }
        onShareCanvas(shareUserId.trim(), shareRole);
        setShareUserId('');
    };

    const openSidebar = () => {
        setIsOpen(true);
    };

    const closeSidebar = () => {
        setIsClosing(true);

        setTimeout(() => {
            setIsClosing(false);
            setIsOpen(false);
        }, 250);
    };

    useImperativeHandle(ref, () => ({
        closeSidebar
    }));

    return (
        <div className="sidebar-container">
            <button
                className="hamburger"
                aria-label="Open menu"
                onClick={openSidebar}
            >
                ☰
            </button>

            {isOpen && (
                <>
                    <div
                        className={`menu-backdrop ${isClosing ? 'closing' : 'open'}`}
                        onClick={closeSidebar}
                    />

                    <aside className={`sidebar-menu ${isClosing ? 'closing' : 'open'}`} role="dialog" aria-modal="true">
                        <div className="sidebar-header">
                            <h2>Menu</h2>
                            <button
                                className="sidebar-close"
                                aria-label="Close menu"
                                onClick={closeSidebar}
                            >
                                ×
                            </button>
                        </div>
                        <div className="sidebar-settings settings">
                            <h3>Settings</h3>
                            <DarkMode />
                            {currentView === "canvas" && <>
                                <button className="gallery-button" onClick={onGalleryClick}>
                                    Gallery
                                </button>
                                <div className="share-panel">
                                    <h4>Share Canvas</h4>
                                    <p>Enter another user's Supabase ID and choose a role.</p>
                                    <input
                                        type="text"
                                        value={shareUserId}
                                        placeholder="Target user ID"
                                        onChange={(event) => setShareUserId(event.target.value)}
                                    />
                                    <select value={shareRole} onChange={(event) => setShareRole(event.target.value)}>
                                        <option value="viewer">Viewer</option>
                                        <option value="editor">Editor</option>
                                    </select>
                                    <button className="share-button" onClick={handleShareClick}>
                                        Share
                                    </button>
                                </div>
                            </>}
                        </div>
                        <div className="login-info settings">
                            <h3>Signed in as {user.name || user.email}</h3>
                            <button className="sign-out" onClick={onSignOutRequest}>
                                Sign out
                            </button>
                        </div>
                    </aside>
                </>
            )}
        </div>
    );
})

export default SidebarMenu;