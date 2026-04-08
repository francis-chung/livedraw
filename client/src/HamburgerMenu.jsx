import { useState } from 'react';
import './hamburgerMenu.css';

export default function HamburgerMenu() {
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
                        <nav className="sidebar-nav">
                            <a href="#">New drawing</a>
                            <a href="#">Settings</a>
                            <a href="#">Help</a>
                        </nav>
                    </aside>
                </>
            )}
        </div>
    );
}