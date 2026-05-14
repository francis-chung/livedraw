const supabase = require('../supabase/supabaseClient');

async function saveCanvas(supabase, userId, name, objects) {
    const { data: existingCanvas, error: fetchError } = await supabase
        .from('canvases')
        .select('id')
        .eq('owner_id', userId)
        .eq('name', name)
        .maybeSingle();
    if (fetchError) {
        throw fetchError;
    }

    let canvas = existingCanvas;
    if (!canvas) {
        const { data, error: insertError } = await supabase
            .from('canvases')
            .insert({ owner_id: userId, name })
            .select('id')
            .single();
        if (insertError) {
            throw insertError;
        }
        canvas = data;
    }

    const { data: existingData, error: existingDataError } = await supabase
        .from('canvas_data')
        .select('*')
        .eq('canvas_id', canvas.id)
        .maybeSingle();
    if (existingDataError) {
        throw existingDataError;
    }

    if (!existingData) {
        const { error: insertError } = await supabase
            .from('canvas_data')
            .insert({
                canvas_id: canvas.id,
                objects
            });
        if (insertError) {
            throw insertError;
        }
    } else {
        const { error: updateError } = await supabase
            .from('canvas_data')
            .update({
                canvas_id: canvas.id,
                objects
            })
            .eq('canvas_id', canvas.id);
        if (updateError) {
            throw updateError;
        }
    }

    return canvas.id;
}

async function loadCanvas(supabase, userId, name) {
    const { data: canvas, error: canvasError } = await supabase
        .from('canvases')
        .select('id')
        .eq('owner_id', userId)
        .eq('name', name)
        .maybeSingle();
    if (canvasError) {
        throw canvasError;
    }
    if (!canvas) return null;

    const { data, error: dataError } = await supabase
        .from('canvas_data')
        .select('objects')
        .eq('canvas_id', canvas.id)
        .maybeSingle();
    if (dataError) {
        throw dataError;
    }
    return data?.objects || [];
}

async function getSavedCanvases(supabase, userId) {
    const { data: canvases, error: canvasError } = await supabase
        .from('canvases')
        .select('id, name')
        .eq('owner_id', userId);
    if (canvasError) {
        throw canvasError;
    }
    if (!canvases || canvases.length === 0) {
        return [];
    }

    const canvasIds = canvases.map((canvas) => canvas.id);
    const { data: dataRows, error: dataError } = await supabase
        .from('canvas_data')
        .select('canvas_id, objects')
        .in('canvas_id', canvasIds);
    if (dataError) {
        throw dataError;
    }

    const canvasDataMap = (dataRows || []).reduce((acc, row) => {
        acc[row.canvas_id] = row.objects || [];
        return acc;
    }, {});

    return canvases.map((canvas) => ({
        id: canvas.id,
        name: canvas.name,
        objects: canvasDataMap[canvas.id] || []
    }));
}

async function deleteCanvas(supabase, userId, name) {
    const { data: canvas, error: fetchError } = await supabase
        .from('canvases')
        .select('id')
        .eq('owner_id', userId)
        .eq('name', name)
        .maybeSingle();
    if (fetchError) {
        throw fetchError;
    }
    if (!canvas) {
        throw new Error('Canvas not found');
    }

    const { error: deleteDataError } = await supabase
        .from('canvas_data')
        .delete()
        .eq('canvas_id', canvas.id);
    if (deleteDataError) {
        throw deleteDataError;
    }

    const { error: deleteCanvasError } = await supabase
        .from('canvases')
        .delete()
        .eq('id', canvas.id);
    if (deleteCanvasError) {
        throw deleteCanvasError;
    }
}

module.exports = {
    saveCanvas,
    loadCanvas,
    getSavedCanvases,
    deleteCanvas
};