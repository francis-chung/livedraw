const supabase = require('../supabase/supabaseClient');

async function createCanvas(userId, name) {
    return await supabase.from('canvases').insert({
        owner_id: userId,
        name
    });
}

module.exports = {
    createCanvas
};