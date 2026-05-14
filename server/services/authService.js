const { createSupabaseClient } = require('../supabase/supabaseClient');

// sets socket user on login or socket connect
// must be called only after verification
// inserts or updates user profile in supabase
async function setUser(socket, user) {
    socket.user = user;
    socket.supabase = createSupabaseClient(socket.accessToken);

    const { data, error } = await socket.supabase
        .from('users')
        .upsert({
            id: user.id,
            email: user.email,
            name: user.name,
            picture: user.picture
        })
        .select();
    if (error) {
        console.error('Error upserting user:', error);
    } else {
        console.log('User upserted successfully');
    }
    socket.emit('authenticated', user);
}

// ensures socket has an authenticated user before proceeding
function requireAuth(socket) {
    if (!socket.user) {
        socket.emit('authenticationError', 'Authentication required');
        return false;
    }
    return true;
}

module.exports = {
    setUser,
    requireAuth
};
