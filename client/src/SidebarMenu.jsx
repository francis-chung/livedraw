import { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import './sidebarMenu.css';
import DarkMode from './DarkMode.jsx';

const SidebarMenu = forwardRef(function SidebarMenu({ user, onGalleryClick, onSignOut }, ref) {
    const [isOpen, setIsOpen] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

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
                        <div className="sidebar-settings">
                            <h3>Settings</h3>
                            <DarkMode />
                            <button className="gallery-button" onClick={onGalleryClick}>
                                Gallery
                            </button>
                        </div>
                        <div className="sidebar-settings">
                            <h3>Signed in as {user.name || user.email}</h3>
                            <button className="sign-out" onClick={onSignOut}>
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