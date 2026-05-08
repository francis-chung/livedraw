require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');

function createSupabaseClient(accessToken = null) {
    const options = {};
    
    if (accessToken) {
        options.global = {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        };
    }
    
    return createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY,
        options
    );
}

async function verifySupabaseToken(accessToken) {
    try {
        const supabase = createSupabaseClient(accessToken);
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error || !user) {
            return null;
        }
        
        return {
            id: user.id,
            email: user.email,
            name: user.user_metadata?.name || user.user_metadata?.full_name || '',
            picture: user.user_metadata?.avatar_url || '',
            sub: user.id
        };
    } catch (error) {
        console.error('Token verification failed:', error);
        return null;
    }
}

module.exports = { createSupabaseClient, verifySupabaseToken };