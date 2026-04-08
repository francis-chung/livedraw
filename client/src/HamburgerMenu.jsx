import { useState } from 'react';
import './hamburgerMenu.css';
import DarkMode from './DarkMode.jsx';

export default function HamburgerMenu() {
    // both states necessary for smooth CSS transition animations
    const [isOpen, setIsOpen] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    const openSidebar = () => {
        setIsOpen(true);
    };

    // isClosing allows smooth transitions in CSS
    // wait 250 ms until animations finish to reset state
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
                        <div className="sidebar-settings">
                            <h3>Settings</h3>
                            <DarkMode />
                        </div>
                    </aside>
                </>
            )}
        </div>
    );
}