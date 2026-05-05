const supabase = require('../supabase/supabaseClient');

async function createCanvas(userId, title) {
    return await supabase.from('canvases').insert({
        owner_id: userId,
        title
    });
}

module.exports = {
    createCanvas
};