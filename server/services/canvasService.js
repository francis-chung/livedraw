const supabase = require('../supabase/supabaseClient');

async function saveCanvas(supabase, userId, name, objects, canvasId = null) {
    let canvas = null;

    // branched process based on if canvas id is available
    if (canvasId) {
        // fetches canvas based on canvas id
        const { data: existingCanvas, error: fetchError } = await supabase
            .from('canvases')
            .select('id, owner_id, name')
            .eq('id', canvasId)
            .maybeSingle();
        if (fetchError) {
            throw fetchError;
        }
        if (!existingCanvas) {
            throw new Error('Canvas not found');
        }
        canvas = existingCanvas;

        // if user does not own canvas, checks if user is an editor
        if (canvas.owner_id !== userId) {
            const { data: access, error: accessError } = await supabase
                .from('canvas_access')
                .select('role')
                .eq('canvas_id', canvasId)
                .eq('user_id', userId)
                .maybeSingle();
            if (accessError) {
                throw accessError;
            }
            if (!access || access.role !== 'editor') {
                throw new Error('You do not have permission to save this canvas');
            }
        }

        // updates canvas name if applicable
        if (canvas.owner_id === userId && canvas.name !== name) {
            const { error: updateNameError } = await supabase
                .from('canvases')
                .update({ name })
                .eq('id', canvasId);
            if (updateNameError) {
                throw updateNameError;
            }
        }
    }

    // case only if canvas id is not available, so canvas is not yet valid
    if (!canvas) {
        // checks if canvas has already been created
        const { data: existingCanvas, error: fetchError } = await supabase
            .from('canvases')
            .select('id')
            .eq('owner_id', userId)
            .eq('name', name)
            .maybeSingle();
        if (fetchError) {
            throw fetchError;
        }

        canvas = existingCanvas;
        // if canvas not created already, create a new one
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
        .select('id, name, owner_id')
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
    return {
        id: canvas.id,
        name: canvas.name,
        owner_id: canvas.owner_id,
        objects: data?.objects || []
    };
}

async function loadCanvasById(supabase, userId, canvasId) {
    // tries loading canvas from canvases table
    const { data: canvas, error: canvasError } = await supabase
        .from('canvases')
        .select('id, name, owner_id')
        .eq('id', canvasId)
        .maybeSingle();
    if (canvasError) {
        throw canvasError;
    }
    if (!canvas) return null;

    // if user does not own canvas, makes sure they have access (any permission)
    if (canvas.owner_id !== userId) {
        const { data: access, error: accessError } = await supabase
            .from('canvas_access')
            .select('role')
            .eq('canvas_id', canvasId)
            .eq('user_id', userId)
            .maybeSingle();
        if (accessError) {
            throw accessError;
        }
        if (!access) {
            return null;
        }
    }

    // loads data to prepare for release
    const { data, error: dataError } = await supabase
        .from('canvas_data')
        .select('objects')
        .eq('canvas_id', canvasId)
        .maybeSingle();
    if (dataError) {
        throw dataError;
    }

    return {
        id: canvas.id,
        name: canvas.name,
        owner_id: canvas.owner_id,
        objects: data?.objects || []
    };
}

async function getSavedCanvases(supabase, userId) {
    // selects all canvases that the user owns
    const { data: ownedCanvases, error: ownedError } = await supabase
        .from('canvases')
        .select('id, name')
        .eq('owner_id', userId);
    if (ownedError) {
        throw ownedError;
    }

    // selects all roles from canvases that the user does not own but has access to
    const { data: sharedAccess, error: sharedAccessError } = await supabase
        .from('canvas_access')
        .select('canvas_id, role')
        .eq('user_id', userId);
    if (sharedAccessError) {
        throw sharedAccessError;
    }

    // creates lists of canvas ids for both owned and shared canvases
    const ownedIds = (ownedCanvases || []).map((canvas) => canvas.id);
    const sharedCanvasIds = (sharedAccess || [])
        .map((access) => access.canvas_id)
        .filter((id) => !ownedIds.includes(id));

    // prepares shared canvases for later (owned canvases already initialized)
    const sharedCanvases = sharedCanvasIds.length > 0
        ? (await supabase.from('canvases').select('id, name, owner_id').in('id', sharedCanvasIds)).data || []
        : [];

    // compiles all canvas ids into one array
    const canvasIds = [
        ...ownedIds,
        ...sharedCanvasIds
    ];

    if (canvasIds.length === 0) {
        return [];
    }

    // obtains canvas data from all canvases
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

    // map that indicates access for canvases, particularly for shared canvases
    const sharedAccessMap = (sharedAccess || []).reduce((acc, access) => {
        acc[access.canvas_id] = access.role;
        return acc;
    }, {});

    const ownedResults = (ownedCanvases || []).map((canvas) => ({
        id: canvas.id,
        name: canvas.name,
        objects: canvasDataMap[canvas.id] || [],
        owner_id: userId,
        shared: false,
        role: 'owner'
    }));

    const sharedResults = (sharedCanvases || []).map((canvas) => ({
        id: canvas.id,
        name: canvas.name,
        objects: canvasDataMap[canvas.id] || [],
        owner_id: canvas.owner_id,
        shared: true,
        role: sharedAccessMap[canvas.id] || 'viewer'
    }));

    return [...ownedResults, ...sharedResults];
}

async function shareCanvas(supabase, ownerId, canvasId, targetUserId, role) {
    // ensures that roles are either viewer or editor
    const validRoles = ['viewer', 'editor'];
    if (!validRoles.includes(role)) {
        throw new Error('Role must be viewer or editor');
    }

    // retrieves canvas and role
    const { data: canvas, error: canvasError } = await supabase
        .from('canvases')
        .select('id, owner_id')
        .eq('id', canvasId)
        .maybeSingle();
    if (canvasError) {
        throw canvasError;
    }
    if (!canvas || canvas.owner_id !== ownerId) {
        throw new Error('Canvas not found or unauthorized');
    }

    // updates / inserts access role
    const { error: upsertError } = await supabase
        .from('canvas_access')
        .upsert({
            canvas_id: canvasId,
            user_id: targetUserId,
            role
        }, { onConflict: ['canvas_id', 'user_id'] });
    if (upsertError) {
        throw upsertError;
    }

    return { canvasId, targetUserId, role };
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
    loadCanvasById,
    getSavedCanvases,
    shareCanvas,
    deleteCanvas
};