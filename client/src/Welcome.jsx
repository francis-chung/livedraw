import { useEffect, useState } from 'react';
import './welcome.css';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// JWT string has format header.payload.signature
const decodeJwt = (token) => {
    // takes payload part of token
    const base64Url = token.split('.')[1];
    // converts base64url to base64 using regex
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    // converts base64 to UTF-8 string
    const jsonPayload = decodeURIComponent(
        atob(base64)
            .split('')
            .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
            .join('')
    );
    return JSON.parse(jsonPayload);
};

export default function Welcome({ onSignIn }) {
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!CLIENT_ID) {
            setError('Set VITE_GOOGLE_CLIENT_ID in client/.env to use Google Sign-In');
            return;
        }

        // sets up google sign-in using google identity services script
        // checks repeatedly if google SDK has loaded, then renders sign-in button
        let attempts = 0;
        // setInterval: browser API function
        const intervalId = window.setInterval(() => {
            if (window.google?.accounts?.id) {
                window.clearInterval(intervalId);
                // registers app with google
                // callback function receives JWT credential
                window.google.accounts.id.initialize({
                    client_id: CLIENT_ID,
                    callback: handleCredentialResponse,
                });

                // inserts google sign-in button 
                window.google.accounts.id.renderButton(
                    document.getElementById('google-signin-button'),
                    { theme: 'outline', size: 'large', width: 280 }
                );
            } else {
                attempts += 1;
                if (attempts >= 20) {
                    window.clearInterval(intervalId);
                    setError('Google Identity Services failed to load. Refresh the page.');
                }
            }
        }, 150);

        return () => window.clearInterval(intervalId);
    }, []);

    // callback from google after login, with credential key
    const handleCredentialResponse = (response) => {
        try {
            const profile = decodeJwt(response.credential);
            onSignIn({
                token: response.credential,
                profile: {
                    sub: profile.sub, /* user id */
                    email: profile.email,
                    name: profile.name,
                    picture: profile.picture,
                },
            });
        } catch (err) {
            setError('Unable to parse Google sign-in response.');
        }
    };

    return (
        <div className="welcome-page">
            <div className="welcome-card">
                <h1>Welcome to LiveDraw</h1>
                <p>Sign in with Google to keep your canvases tied to your account and resume work later.</p>

                <div id="google-signin-button" className="google-button" />

                {error && <div className="welcome-error">{error}</div>}

                {!CLIENT_ID && (
                    <div className="welcome-help">
                        <p>Add your Google client ID to <code>client/.env</code> as <code>VITE_GOOGLE_CLIENT_ID</code>.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
