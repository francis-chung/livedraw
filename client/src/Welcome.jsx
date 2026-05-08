import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import './welcome.css';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export default function Welcome() {
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            setError('Supabase configuration is missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in client/.env');
            return;
        }
    }, []);

    const handleGoogleSignIn = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log(supabase);
            const { data, error: signInError } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}`
                }
            });

            if (signInError) {
                throw signInError;
            }

            // redirect will handle the oauth flow
            // after auth is completed, supabase.auth.onAuthStateChange will trigger
            // for which handling is in App.jsx
        } catch (err) {
            setIsLoading(false);
            console.error('Sign-in error:', err);
            setError(`Unable to sign in: ${err.message || 'Unknown error'}`);
        }
    };

    return (
        <div className="welcome-page">
            <div className="welcome-card">
                <h1>Welcome to Livedraw</h1>
                <p>Sign in with Google to keep your canvases tied to your account and resume work later.</p>

                <button
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    className="google-button"
                >
                    {isLoading ? 'Signing in...' : 'Sign in with Google'}
                </button>

                {error && <div className="welcome-error">{error}</div>}
            </div>
        </div>
    );
}
