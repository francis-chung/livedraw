import { useState } from 'react';
import './hamburgerMenu.css';
import DarkMode from './DarkMode.jsx';

export default function HamburgerMenu({ onGalleryClick }) {
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

    const handleGalleryClick = () => {
        onGalleryClick();
        closeSidebar();
    };

    return (
        <div className="hamburger-container">
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
                            <button className="gallery-button" onClick={handleGalleryClick}>
                                🖼️ Gallery
                            </button>
                        </div>
                    </aside>
                </>
            )}
        </div>
    );
}