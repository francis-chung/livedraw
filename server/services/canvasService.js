import { supabase } from '../supabase/supabaseClient.js';

export async function createCanvas(userId, title) {
    return await supabase.from('canvases').insert({
        ownerId: userId,
        title
    });
}