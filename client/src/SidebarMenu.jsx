import { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import './sidebarMenu.css';
import DarkMode from './DarkMode.jsx';

// forwardRef enables a ref to be passed into function
// allows parent components to access functions of child components
const SidebarMenu = forwardRef(function SidebarMenu({ user, onGalleryClick, onSignOutRequest, currentView }, ref) {
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

    // useImperativeHandle used to customize which functions are exposed 
    // to parent components when using a ref
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
                            {currentView === "canvas" && <button className="gallery-button" onClick={onGalleryClick}>
                                Gallery
                            </button>}
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