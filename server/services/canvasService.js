const supabase = require('../supabase/supabaseClient');

async function saveCanvas(supabase, userId, name, objects, canvasId = null) {
    let canvas = null;

    if (canvasId) {
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

    if (!canvas) {
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
        .select('id, name, owner_id')
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
    return {
        id: canvas.id,
        name: canvas.name,
        owner_id: canvas.owner_id,
        objects: data?.objects || []
    };
}

async function loadCanvasById(supabase, userId, canvasId) {
    const { data: canvas, error: canvasError } = await supabase
        .from('canvases')
        .select('id, name, owner_id')
        .eq('id', canvasId)
        .maybeSingle();
    if (canvasError) {
        throw canvasError;
    }
    if (!canvas) return null;

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
    const { data: ownedCanvases, error: ownedError } = await supabase
        .from('canvases')
        .select('id, name')
        .eq('owner_id', userId);
    if (ownedError) {
        throw ownedError;
    }

    const { data: sharedAccess, error: sharedAccessError } = await supabase
        .from('canvas_access')
        .select('canvas_id, role')
        .eq('user_id', userId);
    if (sharedAccessError) {
        throw sharedAccessError;
    }

    const ownedIds = (ownedCanvases || []).map((canvas) => canvas.id);
    const sharedCanvasIds = (sharedAccess || [])
        .map((access) => access.canvas_id)
        .filter((id) => !ownedIds.includes(id));

    const sharedCanvases = sharedCanvasIds.length > 0
        ? (await supabase.from('canvases').select('id, name, owner_id').in('id', sharedCanvasIds)).data || []
        : [];

    const canvasIds = [
        ...ownedIds,
        ...sharedCanvasIds
    ];

    if (canvasIds.length === 0) {
        return [];
    }

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
    const validRoles = ['viewer', 'editor'];
    if (!validRoles.includes(role)) {
        throw new Error('Role must be viewer or editor');
    }

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
    loadCanvasById,
    getSavedCanvases,
    shareCanvas,
    deleteCanvas
};