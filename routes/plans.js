const express = require('express');
const Plan = require('../models/Plan');
const Department = require('../models/Department');
const { authMiddleware, departmentEditMiddleware } = require('../middleware/auth');
const HrTask = require('../models/HrTask');
const HrCompletion = require('../models/HrCompletion');
const {
    reconcileRdMainTask,
    reconcileRdMainTasks,
    attachSubtaskTaskIds,
    migrateLegacyRdTasksToNested
} = require('../utils/rdTasks');

const router = express.Router();

function findSubtaskInPlan(plan, subtaskId) {
    if (!plan.rdMainTasks?.length) return null;
    const sid = subtaskId.toString();
    for (let mi = 0; mi < plan.rdMainTasks.length; mi++) {
        const mt = plan.rdMainTasks[mi];
        const si = mt.subtasks.findIndex((s) => s._id.toString() === sid);
        if (si !== -1) return { mainTask: mt, mainIndex: mi, subIndex: si, sub: mt.subtasks[si] };
    }
    return null;
}

// Get plans for a department - ALL authenticated users can view
router.get('/department/:deptId', authMiddleware, async (req, res) => {
    try {
        const dept = await Department.findById(req.params.deptId);
        const plans = await Plan.find({ department: req.params.deptId }).sort({ year: -1, month: -1 }).lean();

        if (dept && dept.name === 'Admin') {
            const totalTasks = await HrTask.countDocuments();
            // Helper to convert month name/number to number 1-12
            const monthToNum = (m) => {
                const s = String(m || '').trim().toLowerCase();
                const n = parseInt(s, 10);
                if (!Number.isNaN(n) && n >= 1 && n <= 12) return n;
                const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
                const idx = months.indexOf(s);
                return idx !== -1 ? idx + 1 : null;
            };

            console.log(`[BACKEND] Processing ${plans.length} plans for ADMIN department`);

            for (const plan of plans) {
                const mNum = monthToNum(plan.month);
                if (mNum) {
                    const completedCount = await HrCompletion.countDocuments({
                        month: mNum,
                        year: plan.year
                    });
                    plan.hrStats = {
                        total: totalTasks,
                        completed: completedCount,
                        percentage: totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0
                    };
                } else {
                    plan.hrStats = { total: totalTasks, completed: 0, percentage: 0 };
                }
            }
        }

        res.json(plans);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Create a new plan - Admin can create for any department, Managers can create for their own department
router.post('/', authMiddleware, departmentEditMiddleware, async (req, res) => {
    const { department, month, year, title, description, target, tasks, rdMainTasks } = req.body;

    try {
        const newPlan = new Plan({
            department,
            month,
            year,
            title,
            description,
            target,
            tasks: tasks || [],
            rdMainTasks: rdMainTasks !== undefined ? rdMainTasks : undefined
        });

        if (newPlan.rdMainTasks && newPlan.rdMainTasks.length) {
            newPlan.tasks = [];
        }

        const savedPlan = await newPlan.save();

        // Auto-migrate to rdMainTasks if it's an R&D plan with flat tasks
        // We do this if rdMainTasks is not explicitly provided
        if (rdMainTasks === undefined && tasks?.length > 0) {
            const dept = await Department.findById(department);
            if (dept && dept.name === 'R&D') {
                savedPlan.rdMainTasks = migrateLegacyRdTasksToNested(tasks);
                savedPlan.tasks = []; // Clear flat tasks once migrated
                await savedPlan.save();
            }
        }

        if (savedPlan.rdMainTasks?.length) {
            attachSubtaskTaskIds(savedPlan.rdMainTasks);
            reconcileRdMainTasks(savedPlan.rdMainTasks);
            await savedPlan.save();
        }
        res.status(201).json(savedPlan);
    } catch (err) {
        console.error('Error creating plan:', err);
        res.status(400).json({ message: err.message, error: err });
    }
});

// Update a plan (tasks and/or R&D nested rdMainTasks and metadata)
router.put('/:id/tasks', authMiddleware, departmentEditMiddleware, async (req, res) => {
    try {
        const plan = await Plan.findById(req.params.id);
        if (!plan) {
            return res.status(404).json({ message: 'Plan not found' });
        }

        const { tasks, rdMainTasks, title, month, year, description, target } = req.body;

        if (title !== undefined) plan.title = title;
        if (month !== undefined) plan.month = month;
        if (year !== undefined) plan.year = year;
        if (description !== undefined) plan.description = description;
        if (target !== undefined) plan.target = target;
        if (tasks !== undefined) {
            plan.tasks = tasks;
            // Also update rdMainTasks if this is an R&D department plan
            const dept = await Department.findById(plan.department);
            if (dept && dept.name === 'R&D') {
                plan.rdMainTasks = migrateLegacyRdTasksToNested(tasks);
                plan.tasks = []; // Keep it clean
            }
        }
        if (rdMainTasks !== undefined) {
            plan.rdMainTasks = rdMainTasks;
            plan.tasks = [];
        }

        await plan.save();

        if (plan.rdMainTasks?.length) {
            attachSubtaskTaskIds(plan.rdMainTasks);
            reconcileRdMainTasks(plan.rdMainTasks);
            await plan.save();
        }

        res.json(plan);
    } catch (err) {
        console.error('Error updating plan:', err);
        res.status(400).json({ message: err.message });
    }
});

// --- R&D granular CRUD (nested main tasks / subtasks) ---

router.post('/:id/rd/main-tasks', authMiddleware, departmentEditMiddleware, async (req, res) => {
    try {
        const plan = await Plan.findById(req.params.id);
        if (!plan) return res.status(404).json({ message: 'Plan not found' });

        if (!plan.rdMainTasks) plan.rdMainTasks = [];
        plan.rdMainTasks.push({
            title: req.body.title || '',
            status: req.body.status || 'planning',
            isManualStatusOverride: !!req.body.isManualStatusOverride,
            subtasks: []
        });
        attachSubtaskTaskIds(plan.rdMainTasks);
        await plan.save();
        res.status(201).json(plan);
    } catch (err) {
        console.error('Error adding R&D main task:', err);
        res.status(400).json({ message: err.message });
    }
});

router.post('/:id/rd/main-tasks/:mainTaskId/subtasks', authMiddleware, departmentEditMiddleware, async (req, res) => {
    try {
        const plan = await Plan.findById(req.params.id);
        if (!plan) return res.status(404).json({ message: 'Plan not found' });

        if (!plan.rdMainTasks) plan.rdMainTasks = [];

        const mt = plan.rdMainTasks.id(req.params.mainTaskId);
        if (!mt) return res.status(404).json({ message: 'Main task not found' });

        mt.subtasks.push({
            title: req.body.title || '',
            responsible: req.body.responsible || '',
            assignedEmployee: req.body.assignedEmployee || '',
            status: req.body.status || 'planning',
            remark: req.body.remark || '',
            startDate: req.body.startDate || '',
            endDate: req.body.endDate || '',
            isDone: !!req.body.isDone,
            taskId: mt._id
        });
        reconcileRdMainTask(mt);
        await plan.save();
        attachSubtaskTaskIds(plan.rdMainTasks);
        await plan.save();
        res.status(201).json(plan);
    } catch (err) {
        console.error('Error adding R&D subtask:', err);
        res.status(400).json({ message: err.message });
    }
});

router.patch('/:id/rd/main-tasks/:mainTaskId', authMiddleware, departmentEditMiddleware, async (req, res) => {
    try {
        const plan = await Plan.findById(req.params.id);
        if (!plan) return res.status(404).json({ message: 'Plan not found' });

        if (!plan.rdMainTasks?.length) {
            return res.status(404).json({ message: 'No R&D tasks on this plan' });
        }

        const mt = plan.rdMainTasks.id(req.params.mainTaskId);
        if (!mt) return res.status(404).json({ message: 'Main task not found' });

        if (req.body.title !== undefined) mt.title = req.body.title;
        if (req.body.status !== undefined) {
            mt.status = req.body.status;
            if (req.body.isManualStatusOverride === undefined) {
                mt.isManualStatusOverride = true;
            }
        }
        if (req.body.isManualStatusOverride !== undefined) {
            mt.isManualStatusOverride = !!req.body.isManualStatusOverride;
        }
        reconcileRdMainTask(mt);
        attachSubtaskTaskIds(plan.rdMainTasks);
        await plan.save();
        res.json(plan);
    } catch (err) {
        console.error('Error patching R&D main task:', err);
        res.status(400).json({ message: err.message });
    }
});

router.patch('/:id/rd/subtasks/:subtaskId', authMiddleware, departmentEditMiddleware, async (req, res) => {
    try {
        const plan = await Plan.findById(req.params.id);
        if (!plan) return res.status(404).json({ message: 'Plan not found' });

        const loc = findSubtaskInPlan(plan, req.params.subtaskId);
        if (!loc) return res.status(404).json({ message: 'Subtask not found' });

        const s = loc.sub;
        const body = req.body;
        if (body.title !== undefined) s.title = body.title;
        if (body.responsible !== undefined) s.responsible = body.responsible;
        if (body.assignedEmployee !== undefined) s.assignedEmployee = body.assignedEmployee;
        if (body.status !== undefined) s.status = body.status;
        if (body.remark !== undefined) s.remark = body.remark;
        if (body.startDate !== undefined) s.startDate = body.startDate;
        if (body.endDate !== undefined) s.endDate = body.endDate;
        if (body.isDone !== undefined) s.isDone = !!body.isDone;

        s.taskId = loc.mainTask._id;
        reconcileRdMainTask(loc.mainTask);
        attachSubtaskTaskIds(plan.rdMainTasks);
        await plan.save();
        res.json(plan);
    } catch (err) {
        console.error('Error patching R&D subtask:', err);
        res.status(400).json({ message: err.message });
    }
});

router.delete('/:id/rd/main-tasks/:mainTaskId', authMiddleware, departmentEditMiddleware, async (req, res) => {
    try {
        const plan = await Plan.findById(req.params.id);
        if (!plan) return res.status(404).json({ message: 'Plan not found' });

        if (!plan.rdMainTasks?.length) {
            return res.status(404).json({ message: 'No R&D tasks on this plan' });
        }

        const mt = plan.rdMainTasks.id(req.params.mainTaskId);
        if (!mt) return res.status(404).json({ message: 'Main task not found' });

        mt.deleteOne();
        await plan.save();
        res.json(plan);
    } catch (err) {
        console.error('Error deleting R&D main task:', err);
        res.status(400).json({ message: err.message });
    }
});

router.delete('/:id/rd/subtasks/:subtaskId', authMiddleware, departmentEditMiddleware, async (req, res) => {
    try {
        const plan = await Plan.findById(req.params.id);
        if (!plan) return res.status(404).json({ message: 'Plan not found' });

        const loc = findSubtaskInPlan(plan, req.params.subtaskId);
        if (!loc) return res.status(404).json({ message: 'Subtask not found' });

        loc.mainTask.subtasks.splice(loc.subIndex, 1);
        reconcileRdMainTask(loc.mainTask);
        attachSubtaskTaskIds(plan.rdMainTasks);
        await plan.save();
        res.json(plan);
    } catch (err) {
        console.error('Error deleting R&D subtask:', err);
        res.status(400).json({ message: err.message });
    }
});

// Delete a plan - Admin can delete any, Managers can delete their own department
router.delete('/:id', authMiddleware, departmentEditMiddleware, async (req, res) => {
    try {
        const plan = await Plan.findByIdAndDelete(req.params.id);
        if (!plan) return res.status(404).json({ message: 'Plan not found' });
        res.json({ message: 'Plan deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
