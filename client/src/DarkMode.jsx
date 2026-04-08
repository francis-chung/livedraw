import { useState, useEffect } from 'react';
import './hamburgerMenu.css';

export default function DarkMode() {
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const stored = localStorage.getItem("isDarkMode");
        return stored ? JSON.parse(stored) : false;
    });
    const [DarkModeText, setDarkModeText] = useState(isDarkMode ? "Light Mode" : "Dark Mode");

    useEffect(() => {
        document.body.className = isDarkMode ? "dark" : "light";
        setDarkModeText(isDarkMode ? "Light Mode" : "Dark Mode");
        localStorage.setItem("isDarkMode", JSON.stringify(isDarkMode));
    }, [isDarkMode]);

    return (
        <div className="theme-toggle-container">
            <button className="theme-toggle-button" onClick={() => setIsDarkMode(!isDarkMode)}>
                {DarkModeText}
            </button>
        </div>
    )
}