/**
 * R&D nested main tasks / subtasks helpers.
 */

function isSubtaskComplete(s) {
    if (!s) return false;
    if (s.isDone === true) return true;
    const st = (s.status || '').toLowerCase();
    return st === 'completed' || st === 'published';
}

/**
 * Auto-sync parent status from subtasks when not manually overridden.
 */
function reconcileRdMainTask(mt) {
    if (!mt || mt.isManualStatusOverride) return;
    const subs = (mt.subtasks || []).filter((s) => (s.title || '').trim() !== '');
    if (subs.length === 0) return;
    const allDone = subs.every(isSubtaskComplete);
    if (allDone) {
        mt.status = 'completed';
    } else if ((mt.status || '').toLowerCase() === 'completed') {
        mt.status = 'developing';
    }
}

function reconcileRdMainTasks(rdMainTasks) {
    if (!Array.isArray(rdMainTasks)) return rdMainTasks;
    for (const mt of rdMainTasks) {
        reconcileRdMainTask(mt);
        if (mt.subtasks && mt._id) {
            for (const s of mt.subtasks) {
                s.taskId = mt._id;
            }
        }
    }
    return rdMainTasks;
}

function attachSubtaskTaskIds(rdMainTasks) {
    if (!Array.isArray(rdMainTasks)) return;
    for (const mt of rdMainTasks) {
        if (!mt.subtasks || !mt._id) continue;
        for (const s of mt.subtasks) {
            s.taskId = mt._id;
        }
    }
}

/**
 * Convert legacy flat R&D rows (product / mediaType / …) to rdMainTasks[].
 */
function migrateLegacyRdTasksToNested(tasks) {
    if (!tasks || !tasks.length) return [];
    const groups = [];
    let current = null;

    const pushSubFromRow = (row) => {
        if (!current) return;
        const title = (row.mediaType || '').trim();
        if (!title) return;
        current.subtasks.push({
            title,
            responsible: row.marketingChannel || '',
            assignedEmployee: row.owner || '',
            status: row.status || 'planning',
            remark: [row.mainGoal, row.description].filter(Boolean).join(' — ') || '',
            startDate: row.startDate || '',
            endDate: row.endDate || '',
            isDone: !!(row.done || (row.status || '').toLowerCase() === 'completed')
        });
    };

    for (const row of tasks) {
        const product = (row.product || '').trim();
        if (product) {
            if (current) groups.push(current);
            current = {
                title: product,
                status: row.status || 'planning',
                isManualStatusOverride: false,
                subtasks: []
            };
            pushSubFromRow(row);
        } else if (current) {
            pushSubFromRow(row);
        }
    }
    if (current) groups.push(current);

    return groups.filter((g) => (g.title || '').trim() !== '' || (g.subtasks && g.subtasks.length > 0));
}

module.exports = {
    reconcileRdMainTask,
    reconcileRdMainTasks,
    attachSubtaskTaskIds,
    migrateLegacyRdTasksToNested,
    isSubtaskComplete
};
