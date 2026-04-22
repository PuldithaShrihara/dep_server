const express = require('express');
const mongoose = require('mongoose');
const HrMember = require('../models/HrMember');
const HrArea = require('../models/HrArea');
const HrTask = require('../models/HrTask');
const HrCompletion = require('../models/HrCompletion');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { ensureRecruitmentTasksFromSeed } = require('../utils/seedHrEntities');

const router = express.Router();

router.use(authMiddleware);
router.use(requireAdmin);

function parseMonthYear(req) {
    const month = parseInt(req.query.month, 10);
    const year = parseInt(req.query.year, 10);
    if (!Number.isFinite(month) || month < 1 || month > 12) return { error: 'Invalid or missing month (1-12)' };
    if (!Number.isFinite(year) || year < 2000 || year > 2100) return { error: 'Invalid or missing year' };
    return { month, year };
}

function formatCompletionDoc(c) {
    const task = c.task;
    const member = c.member;
    const area = task && typeof task === 'object' && task.area && typeof task.area === 'object' ? task.area : null;
    const observedBy = c.observedBy;
    return {
        completionId: String(c._id),
        taskId: task ? String(task._id || task) : null,
        taskLabel: task && task.label ? task.label : '',
        areaTitle: area && area.title ? area.title : '',
        memberId: member ? String(member._id || member) : null,
        memberName: member && member.name ? member.name : '',
        memberRole: member && member.role ? member.role : '',
        observedById: observedBy ? String(observedBy._id || observedBy) : null,
        observedByName: observedBy && observedBy.name ? observedBy.name : '',
        observedByRole: observedBy && observedBy.role ? observedBy.role : '',
        remarks: c.remarks || '',
        completedAt: c.completedAt
    };
}

/** GET /api/members */
router.get('/members', async (req, res) => {
    try {
        const list = await HrMember.find().sort({ sortOrder: 1, name: 1 }).lean();
        res.json(list.map((m) => ({ id: String(m._id), name: m.name, role: m.role, sortOrder: m.sortOrder })));
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

/** GET /api/areas — areas with nested tasks */
router.get('/areas', async (req, res) => {
    try {
        await ensureRecruitmentTasksFromSeed();
        const areas = await HrArea.find().sort({ sortOrder: 1, title: 1 }).lean();
        const areaOrder = new Map(areas.map((a) => [String(a._id), a.sortOrder]));
        const tasks = await HrTask.find().lean();
        tasks.sort((a, b) => {
            const aid = String(a.area);
            const bid = String(b.area);
            const oa = areaOrder.get(aid) ?? 999;
            const ob = areaOrder.get(bid) ?? 999;
            if (oa !== ob) return oa - ob;
            return (a.sortOrder || 0) - (b.sortOrder || 0);
        });
        const byArea = new Map();
        for (const t of tasks) {
            const aid = String(t.area);
            if (!byArea.has(aid)) byArea.set(aid, []);
            byArea.get(aid).push({
                id: String(t._id),
                label: t.label,
                subLabel: t.subLabel || ''
            });
        }
        const out = areas.map((a) => ({
            id: String(a._id),
            title: a.title,
            category: a.category,
            frequency: a.frequency,
            tasks: byArea.get(String(a._id)) || []
        }));
        res.json(out);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

/** GET /api/tasks — flat list */
router.get('/tasks', async (req, res) => {
    try {
        const areas = await HrArea.find().sort({ sortOrder: 1 }).select('_id sortOrder').lean();
        const areaOrder = new Map(areas.map((a) => [String(a._id), a.sortOrder]));
        const tasks = await HrTask.find().populate('area', 'title category frequency sortOrder').lean();
        tasks.sort((a, b) => {
            const aid = String(a.area?._id || a.area);
            const bid = String(b.area?._id || b.area);
            const oa = areaOrder.get(aid) ?? 999;
            const ob = areaOrder.get(bid) ?? 999;
            if (oa !== ob) return oa - ob;
            return (a.sortOrder || 0) - (b.sortOrder || 0);
        });
        res.json(
            tasks.map((t) => ({
                id: String(t._id),
                label: t.label,
                subLabel: t.subLabel || '',
                areaId: t.area ? String(t.area._id) : null,
                areaTitle: t.area && t.area.title ? t.area.title : '',
                category: t.area && t.area.category ? t.area.category : '',
                frequency: t.area && t.area.frequency ? t.area.frequency : ''
            }))
        );
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

/** POST /api/tasks — add a new custom task to an area */
router.post('/tasks', async (req, res) => {
    try {
        const { areaId, label, subLabel } = req.body;
        if (!mongoose.isValidObjectId(areaId)) {
            return res.status(400).json({ message: 'Invalid areaId' });
        }
        if (!label || !String(label).trim()) {
            return res.status(400).json({ message: 'Task label is required' });
        }

        const area = await HrArea.findById(areaId);
        if (!area) return res.status(404).json({ message: 'Area not found' });

        // Determine sortOrder by counting existing tasks in this area
        const currentCount = await HrTask.countDocuments({ area: areaId });
        
        const newTask = await HrTask.create({
            area: areaId,
            label: String(label).trim(),
            subLabel: subLabel ? String(subLabel).trim() : '',
            sortOrder: currentCount
        });

        res.status(201).json({
            id: String(newTask._id),
            label: newTask.label,
            subLabel: newTask.subLabel,
            areaId: String(newTask.area),
            areaTitle: area.title,
            category: area.category,
            frequency: area.frequency
        });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ message: 'A task with this label already exists in this category' });
        }
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

/** DELETE /api/tasks/:id — remove a custom task and its completions */
router.delete('/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: 'Invalid task id' });
        }

        // Delete the task
        const taskResult = await HrTask.deleteOne({ _id: id });
        if (taskResult.deletedCount === 0) {
            return res.status(404).json({ message: 'Task not found' });
        }

        // Also delete associated completions
        await HrCompletion.deleteMany({ task: id });

        res.json({ message: 'Task and related completions removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

/** GET /api/completions/by-member?month=&year= */
router.get('/completions/by-member', async (req, res) => {
    try {
        const parsed = parseMonthYear(req);
        if (parsed.error) return res.status(400).json({ message: parsed.error });

        const list = await HrCompletion.find({ month: parsed.month, year: parsed.year })
            .populate('member', 'name role sortOrder')
            .lean();

        const byMember = new Map();
        for (const c of list) {
            if (!c.member) continue;
            const mid = String(c.member._id);
            if (!byMember.has(mid)) {
                byMember.set(mid, {
                    memberId: mid,
                    memberName: c.member.name,
                    memberRole: c.member.role,
                    count: 0
                });
            }
            byMember.get(mid).count += 1;
        }
        res.json(Array.from(byMember.values()));
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

/** GET /api/completions/by-area?month=&year= */
router.get('/completions/by-area', async (req, res) => {
    try {
        const parsed = parseMonthYear(req);
        if (parsed.error) return res.status(400).json({ message: parsed.error });

        const list = await HrCompletion.find({ month: parsed.month, year: parsed.year })
            .populate({ path: 'task', select: 'area', populate: { path: 'area', select: 'title' } })
            .lean();

        const byArea = new Map();
        for (const c of list) {
            const area = c.task && c.task.area;
            const aid = area ? String(area._id) : 'unknown';
            const title = area && area.title ? area.title : 'Unknown';
            if (!byArea.has(aid)) byArea.set(aid, { areaId: aid, areaTitle: title, count: 0 });
            byArea.get(aid).count += 1;
        }
        res.json(Array.from(byArea.values()));
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

/** GET /api/completions/summary?month=&year= */
router.get('/completions/summary', async (req, res) => {
    try {
        const parsed = parseMonthYear(req);
        if (parsed.error) return res.status(400).json({ message: parsed.error });

        const totalTasks = await HrTask.countDocuments();
        const completedCount = await HrCompletion.countDocuments({
            month: parsed.month,
            year: parsed.year
        });
        const memberIds = await HrCompletion.distinct('member', {
            month: parsed.month,
            year: parsed.year
        });

        const completionPercent =
            totalTasks === 0 ? 0 : Math.min(100, Math.round((completedCount / totalTasks) * 100));

        res.json({
            totalTasks,
            completedCount,
            completionPercent,
            activeMembersCount: memberIds.length
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

/** POST /api/completions */
router.post('/completions', async (req, res) => {
    try {
        const { taskId, memberId, observedByMemberId, remarks, month, year } = req.body || {};
        if (!mongoose.isValidObjectId(taskId) || !mongoose.isValidObjectId(memberId)) {
            return res.status(400).json({ message: 'taskId and memberId must be valid ids' });
        }
        const m = parseInt(month, 10);
        const y = parseInt(year, 10);
        if (!Number.isFinite(m) || m < 1 || m > 12) return res.status(400).json({ message: 'month must be 1-12' });
        if (!Number.isFinite(y) || y < 2000 || y > 2100) return res.status(400).json({ message: 'invalid year' });

        const [task, member] = await Promise.all([HrTask.findById(taskId), HrMember.findById(memberId)]);
        if (!task) return res.status(404).json({ message: 'Task not found' });
        if (!member) return res.status(404).json({ message: 'Member not found' });

        const completedAt = new Date();
        let doc;
        let observedMember = null;
        if (observedByMemberId) {
            if (!mongoose.isValidObjectId(observedByMemberId)) {
                return res.status(400).json({ message: 'observedByMemberId must be a valid id' });
            }
            observedMember = await HrMember.findById(observedByMemberId);
            if (!observedMember) return res.status(404).json({ message: 'Observed member not found' });
        }
        try {
            doc = await HrCompletion.create({
                task: task._id,
                member: member._id,
                observedBy: observedMember ? observedMember._id : member._id,
                remarks: typeof remarks === 'string' ? remarks : '',
                completedAt,
                month: m,
                year: y
            });
        } catch (e) {
            if (e && e.code === 11000) {
                return res.status(409).json({ message: 'This task is already completed for the selected month/year' });
            }
            throw e;
        }

        const populated = await HrCompletion.findById(doc._id)
            .populate({ path: 'task', populate: { path: 'area', select: 'title' } })
            .populate('member', 'name role')
            .populate('observedBy', 'name role')
            .lean();

        res.status(201).json({
            ...formatCompletionDoc(populated),
            message: 'Completion saved'
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

/** DELETE /api/completions/:id */
router.delete('/completions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Invalid completion id' });
        const result = await HrCompletion.deleteOne({ _id: id });
        if (result.deletedCount === 0) return res.status(404).json({ message: 'Completion not found' });
        res.json({ message: 'Completion removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

/** PATCH /api/completions/:id */
router.patch('/completions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { memberId, observedByMemberId, remarks } = req.body;
        if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Invalid completion Reference ID' });

        const updateData = {};
        
        // Handle member/assignedBy (Required by schema, so we only update if valid ID)
        if (memberId) {
            if (mongoose.isValidObjectId(memberId)) {
                updateData.member = memberId;
            } else {
                return res.status(400).json({ message: 'Invalid Assigned Member ID' });
            }
        }
        
        // Handle observedBy (Optional, can be unset by passing empty string or null)
        if (observedByMemberId !== undefined) {
            if (!observedByMemberId || observedByMemberId === '') {
                updateData.observedBy = null;
            } else if (mongoose.isValidObjectId(observedByMemberId)) {
                updateData.observedBy = observedByMemberId;
            } else {
                return res.status(400).json({ message: 'Invalid Observed Member ID' });
            }
        }
        
        if (typeof remarks === 'string') updateData.remarks = remarks;

        const updated = await HrCompletion.findByIdAndUpdate(id, updateData, { returnDocument: 'after' })
            .populate({ path: 'task', populate: { path: 'area', select: 'title category frequency' } })
            .populate('member', 'name role')
            .populate('observedBy', 'name role')
            .lean();

        if (!updated) return res.status(404).json({ message: 'Matching completion record not found' });

        res.json(formatCompletionDoc(updated));
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

/** GET /api/completions?month=&year= */
router.get('/completions', async (req, res) => {
    try {
        const parsed = parseMonthYear(req);
        if (parsed.error) return res.status(400).json({ message: parsed.error });

        const list = await HrCompletion.find({ month: parsed.month, year: parsed.year })
            .populate({ path: 'task', populate: { path: 'area', select: 'title category frequency' } })
            .populate('member', 'name role')
            .populate('observedBy', 'name role')
            .sort({ completedAt: -1 })
            .lean();

        res.json(list.map(formatCompletionDoc));
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
