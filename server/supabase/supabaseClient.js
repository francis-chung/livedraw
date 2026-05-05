require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');

function createSupabaseClient(userId) {
    createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY,
        {
            global: {
                headers: {
                    'x-user-id': userId
                }
            }
        }
    );
}

module.exports = createSupabaseClient;