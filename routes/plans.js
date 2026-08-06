const express = require('express');
const Plan = require('../models/Plan');
const Product = require('../models/Product');
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

function logRequestDebug(req) {
    console.log('METHOD:', req.method);
    console.log('URL:', req.originalUrl);
    console.log('CONTENT TYPE:', req.headers['content-type']);
    console.log('BODY:', req.body);
    console.log('FILE:', req.file);
}

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

function isMarketingTaskCompleted(task) {
    const status = (task?.status || '').toLowerCase();
    return status === 'completed' || (task?.done === true && !status);
}

function isMarketingSubtask(task) {
    return !!task?._isSubtask || (task?.product === '' && (task?.mediaType !== '' || task?.mainGoal !== ''));
}

function completeMarketingTask(task, completedAt) {
    return {
        ...task,
        done: true,
        status: 'completed',
        dateCompleted: task.dateCompleted || task.completedTime || completedAt,
        completedTime: task.completedTime || formatDateTime(completedAt)
    };
}

function cascadeCompletedMarketingMainTasks(tasks = []) {
    if (!Array.isArray(tasks)) return tasks;

    const cascaded = tasks.map((task) => ({ ...task }));

    for (let index = 0; index < cascaded.length; index++) {
        const task = cascaded[index];
        if (isMarketingSubtask(task) || !isMarketingTaskCompleted(task)) continue;

        const completedAt = task.dateCompleted || task.completedTime || new Date();

        for (let childIndex = index + 1; childIndex < cascaded.length; childIndex++) {
            if (!isMarketingSubtask(cascaded[childIndex])) break;
            cascaded[childIndex] = completeMarketingTask(cascaded[childIndex], completedAt);
        }
    }

    return cascaded;
}

function applyNestedCompletionDate(task, incomingStatus, incomingIsDone) {
    const status = incomingStatus !== undefined ? incomingStatus : task.status;
    const isDone = incomingIsDone !== undefined ? incomingIsDone : task.isDone;
    const normalizedStatus = (status || '').toLowerCase();
    const completed = normalizedStatus === 'completed' || (isDone === true && !normalizedStatus);
    task.dateCompleted = completed ? (task.dateCompleted || new Date()) : null;
}

function normalizeMarketingTaskCompletionDates(incomingTasks = [], existingTasks = []) {
    if (!Array.isArray(incomingTasks)) return incomingTasks;

    return incomingTasks.map((task, index) => {
        const nextTask = { ...task };
        const previousTask = existingTasks[index] || {};

        if (isMarketingTaskCompleted(nextTask)) {
            const existingDate =
                nextTask.dateCompleted ||
                nextTask.completedTime ||
                previousTask.dateCompleted ||
                previousTask.completedTime;

            const date = existingDate ? new Date(existingDate) : new Date();
            nextTask.dateCompleted = Number.isNaN(date.getTime()) ? new Date() : date;

            if (!nextTask.completedTime) {
                nextTask.completedTime = formatDateTime(nextTask.dateCompleted);
            }
        } else {
            nextTask.dateCompleted = null;
            nextTask.completedTime = '';
        }

        return nextTask;
    });
}

function formatDateTime(value) {
    const date = value instanceof Date ? value : new Date(value);
    const pad = (num) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// Get plans for a department - ALL authenticated users can view
router.get('/department/:deptId', authMiddleware, async (req, res) => {
    try {
        const dept = await Department.findById(req.params.deptId);
        const { page, limit } = req.query;

        const baseQuery = Plan.find({ department: req.params.deptId })
            .populate('products')
            .select('-tasks -rdMainTasks')
            .sort({ year: -1, month: -1 });

        const monthToNum = (m) => {
            const s = String(m || '').trim().toLowerCase();
            const n = parseInt(s, 10);
            if (!Number.isNaN(n) && n >= 1 && n <= 12) return n;
            const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
            const idx = months.indexOf(s);
            return idx !== -1 ? idx + 1 : null;
        };

        const addHrStats = async (plansList) => {
            if (dept && dept.name === 'Admin') {
                const totalTasks = await HrTask.countDocuments();
                const hrCompletions = await HrCompletion.aggregate([
                    { $group: { _id: { month: "$month", year: "$year" }, count: { $sum: 1 } } }
                ]);
                
                const completionMap = new Map();
                hrCompletions.forEach(c => {
                    completionMap.set(`${c._id.month}-${c._id.year}`, c.count);
                });

                for (const plan of plansList) {
                    const mNum = monthToNum(plan.month);
                    if (mNum) {
                        const completedCount = completionMap.get(`${mNum}-${plan.year}`) || 0;
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
        };

        if (page !== undefined) {
            const pageNum = Math.max(1, parseInt(page, 10) || 1);
            const limitNum = Math.max(1, parseInt(limit, 10) || 10);
            const skipNum = (pageNum - 1) * limitNum;

            const totalRecords = await Plan.countDocuments({ department: req.params.deptId });
            const totalPages = Math.ceil(totalRecords / limitNum);

            const plans = await baseQuery.skip(skipNum).limit(limitNum).lean();
            await addHrStats(plans);

            return res.json({
                data: plans,
                currentPage: pageNum,
                totalPages,
                totalRecords,
                hasNextPage: pageNum < totalPages,
                hasPreviousPage: pageNum > 1
            });
        }

        const plans = await baseQuery.lean();
        await addHrStats(plans);
        res.json(plans);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Create a new plan - Admin can create for any department, Managers can create for their own department
router.post('/', authMiddleware, departmentEditMiddleware, async (req, res) => {
    console.log(`[DEBUG] POST /api/plans hit with body:`, req.body);
    const { department, month, year, title, description, target, tasks, rdMainTasks, productIds } = req.body || {};

    try {
        const existingProducts = await Product.find({ departmentId: department }).select('_id');
        const autoProductIds = existingProducts.map(p => p._id);

        const newPlan = new Plan({
            department,
            month,
            year,
            title,
            description,
            target,
            tasks: normalizeMarketingTaskCompletionDates(cascadeCompletedMarketingMainTasks(tasks || [])),
            rdMainTasks: rdMainTasks !== undefined ? rdMainTasks : undefined,
            products: autoProductIds
        });

        // Ensure tasks is always an array
        if (!newPlan.tasks) newPlan.tasks = [];

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
        const populatedPlan = await Plan.findById(savedPlan._id).populate('products').populate('department');
        res.status(201).json(populatedPlan);
    } catch (err) {
        console.error('Error creating plan:', err);
        res.status(400).json({ message: err.message, error: err });
    }
});

// Get a single plan by ID
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const plan = await Plan.findById(req.params.id)
            .populate('products')
            .populate('department');

        if (!plan) {
            return res.status(404).json({ message: 'Plan not found' });
        }

        res.json(plan);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch plan', error: error.message });
    }
});

// Update plan metadata (title/month/status/products)
router.put('/:id', authMiddleware, departmentEditMiddleware, async (req, res) => {
    logRequestDebug(req);

    try {
        const { title, month, status, products } = req.body || {};
        const updateData = {};

        if (title !== undefined) updateData.title = title;
        if (month !== undefined) updateData.month = month;
        if (status !== undefined) updateData.status = status;
        if (products !== undefined) updateData.products = products;

        const plan = await Plan.findByIdAndUpdate(req.params.id, updateData, {
            new: true,
            runValidators: true
        });

        if (!plan) {
            return res.status(404).json({ message: 'Plan not found' });
        }

        const populatedPlan = await Plan.findById(plan._id).populate('products');

        res.json(populatedPlan);
    } catch (error) {
        console.error('Error updating plan:', error);
        res.status(500).json({ message: error.message });
    }
});

// Update a plan (tasks and/or R&D nested rdMainTasks and metadata)
router.put('/:id/tasks', authMiddleware, departmentEditMiddleware, async (req, res) => {
    logRequestDebug(req);

    try {
        const plan = await Plan.findById(req.params.id);
        if (!plan) {
            return res.status(404).json({ message: 'Plan not found' });
        }

        const { tasks, rdMainTasks, title, month, year, description, target, productMetrics } = req.body || {};

        if (title !== undefined) plan.title = title;
        if (month !== undefined) plan.month = month;
        if (year !== undefined) plan.year = year;
        if (description !== undefined) plan.description = description;
        if (target !== undefined) plan.target = target;
        if (productMetrics !== undefined) plan.productMetrics = productMetrics;
        if (tasks !== undefined) {
            // Apply duration calculation to all tasks securely on backend
            tasks.forEach(task => {
                if (task.startDate && task.endDate) {
                    const [sYear, sMonth, sDay] = task.startDate.split('-');
                    const [eYear, eMonth, eDay] = task.endDate.split('-');
                    if (sYear && sMonth && sDay && eYear && eMonth && eDay) {
                        const start = Date.UTC(parseInt(sYear, 10), parseInt(sMonth, 10) - 1, parseInt(sDay, 10));
                        const end = Date.UTC(parseInt(eYear, 10), parseInt(eMonth, 10) - 1, parseInt(eDay, 10));
                        if (end < start) {
                            task.duration = '';
                        } else {
                            const diffTime = Math.abs(end - start);
                            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                            task.duration = diffDays === 1 ? '1 day' : `${diffDays} days`;
                        }
                    } else {
                        task.duration = '';
                    }
                } else {
                    task.duration = '';
                }
            });
            plan.tasks = normalizeMarketingTaskCompletionDates(cascadeCompletedMarketingMainTasks(tasks), plan.tasks || []);
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

        const populatedPlan = await Plan.findById(plan._id).populate('products');

        res.json(populatedPlan);
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

        const body = req.body || {};
        if (!plan.rdMainTasks) plan.rdMainTasks = [];
        plan.rdMainTasks.push({
            title: body.title || '',
            status: body.status || 'planning',
            isManualStatusOverride: !!body.isManualStatusOverride,
            dateCompleted: (body.status || '').toLowerCase() === 'completed' || (body.isDone === true && !body.status) ? new Date() : null,
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

        const body = req.body || {};
        if (!plan.rdMainTasks) plan.rdMainTasks = [];

        const mt = plan.rdMainTasks.id(req.params.mainTaskId);
        if (!mt) return res.status(404).json({ message: 'Main task not found' });

        mt.subtasks.push({
            title: body.title || '',
            responsible: body.responsible || '',
            assignedEmployee: body.assignedEmployee || '',
            status: body.status || 'planning',
            remark: body.remark || '',
            startDate: body.startDate || '',
            endDate: body.endDate || '',
            dateCompleted: (body.status || '').toLowerCase() === 'completed' || (body.isDone === true && !body.status) ? new Date() : null,
            isDone: !!body.isDone,
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

        const body = req.body || {};
        if (body.title !== undefined) mt.title = body.title;
        if (body.status !== undefined) {
            mt.status = body.status;
            if (body.isManualStatusOverride === undefined) {
                mt.isManualStatusOverride = true;
            }
        }
        if (body.isManualStatusOverride !== undefined) {
            mt.isManualStatusOverride = !!body.isManualStatusOverride;
        }
        if (body.status !== undefined || body.isDone !== undefined) {
            applyNestedCompletionDate(mt, body.status, body.isDone);
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
        const body = req.body || {};
        if (body.title !== undefined) s.title = body.title;
        if (body.responsible !== undefined) s.responsible = body.responsible;
        if (body.assignedEmployee !== undefined) s.assignedEmployee = body.assignedEmployee;
        if (body.status !== undefined) s.status = body.status;
        if (body.remark !== undefined) s.remark = body.remark;
        if (body.startDate !== undefined) s.startDate = body.startDate;
        if (body.endDate !== undefined) s.endDate = body.endDate;
        if (body.isDone !== undefined) s.isDone = !!body.isDone;
        if (body.status !== undefined || body.isDone !== undefined) {
            applyNestedCompletionDate(s, body.status, body.isDone);
        }

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

// --- Product Management ---
router.post('/:id/products', authMiddleware, departmentEditMiddleware, async (req, res) => {
    logRequestDebug(req);

    try {
        const plan = await Plan.findById(req.params.id);
        if (!plan) return res.status(404).json({ message: 'Plan not found' });

        const { productId, name, description = '', image = '', category = '' } = req.body || {};
        let productEntry = {
            name: (name || '').trim(),
            description,
            image,
            category
        };

        if (productId) {
            const product = await Product.findById(productId);
            if (!product) {
                return res.status(404).json({ message: 'Linked global product not found' });
            }
            productEntry = {
                productId: product._id,
                name: product.name,
                description: product.description,
                image: product.image,
                category: product.category
            };
        }

        if (!productEntry.name) {
            return res.status(400).json({ message: 'Product name is required' });
        }

        if (!plan.products) plan.products = [];
        plan.products.push(productId ? productEntry.productId : null); // Note: Since the schema requires ObjectId, we shouldn't push embedded objects anymore. 

        await plan.save();
        const populatedPlan = await Plan.findById(plan._id).populate('products');
        res.status(201).json(populatedPlan);
    } catch (err) {
        console.error('Error adding product:', err);
        res.status(400).json({ message: err.message });
    }
});

router.delete('/:id/products/:productName', authMiddleware, departmentEditMiddleware, async (req, res) => {
    try {
        const plan = await Plan.findById(req.params.id);
        if (!plan) return res.status(404).json({ message: 'Plan not found' });

        const pName = req.params.productName;
        const pNameLower = pName.toLowerCase();

        // 1. Remove from the products definition array (if it exists)
        if (plan.products && Array.isArray(plan.products)) {
            plan.products = plan.products.filter(p => p.name !== pName);
        }

        // 2. Remove all associated tasks/campaigns
        if (Array.isArray(plan.tasks)) {
            const originalLength = plan.tasks.length;
            plan.tasks = plan.tasks.filter(t => {
                const taskProdLower = (t.product || '').toLowerCase();
                const taskAssetsLower = (t.assets || '').toLowerCase();
                const matches = (taskProdLower === pNameLower || taskAssetsLower === pNameLower);
                return !matches;
            });
            
            if (plan.tasks.length !== originalLength) {
                plan.markModified('tasks');
            }
        }

        await plan.save();
        res.json(plan);
    } catch (err) {
        console.error('Error deleting product:', err);
        res.status(400).json({ message: err.message });
    }
});

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
