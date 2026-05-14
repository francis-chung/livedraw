// saves canvas and canvas data to supabase database
async function saveCanvas(supabase, userId, name, objects) {
    // checks if there is an existing canvas matching the current one
    const { data: existingCanvas, error: fetchError } = await supabase
        .from('canvases')
        .select('id')
        .eq('owner_id', userId)
        .eq('name', name)
        .maybeSingle();
    if (fetchError) {
        throw fetchError;
    }

    // if no existing canvas, insert one and save it
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

    // checks if data of current canvas is available, required for future branching
    const { data: existingData, error: existingDataError } = await supabase
        .from('canvas_data')
        .select('*')
        .eq('canvas_id', canvas.id)
        .maybeSingle();
    if (existingDataError) {
        throw existingDataError;
    }

    // inserts data if no existing data is available
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
    } else { // updates data if existing data is already present
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
    // checks if the canvas requested is available
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

    // returns canvas data if canvas is available
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
    // selects ids and names from all valid canvases
    const { data: canvases, error: canvasError } = await supabase
        .from('canvases')
        .select('id, name')
        .eq('owner_id', userId);
    if (canvasError) {
        throw canvasError;
    }
    // returns empty list if no canvases available
    if (!canvases || canvases.length === 0) {
        return [];
    }

    // selects canvas ids and objects to set up for canvas return
    const canvasIds = canvases.map((canvas) => canvas.id);
    const { data: dataRows, error: dataError } = await supabase
        .from('canvas_data')
        .select('canvas_id, objects')
        .in('canvas_id', canvasIds);
    if (dataError) {
        throw dataError;
    }

    // creates a map from canvas ids to objects
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
    // finds the canvas to be deleted
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

    // removes canvas data corresponding to canvas
    const { error: deleteDataError } = await supabase
        .from('canvas_data')
        .delete()
        .eq('canvas_id', canvas.id);
    if (deleteDataError) {
        throw deleteDataError;
    }

    // removes canvas itself
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