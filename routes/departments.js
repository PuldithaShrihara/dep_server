const express = require('express');
const Department = require('../models/Department');
const Plan = require('../models/Plan');
const { authMiddleware } = require('../middleware/auth');
const { migrateLegacyRdTasksToNested, isSubtaskComplete } = require('../utils/rdTasks');

const router = express.Router();

const calculatePlanPercentage = (plan, departmentName) => {
    if (departmentName === 'R&D') {
        const mts = plan.rdMainTasks && plan.rdMainTasks.length > 0 
            ? plan.rdMainTasks 
            : migrateLegacyRdTasksToNested(plan.tasks || []);

        if (!mts.length) return 0;

        let totalItems = 0;
        let completedItems = 0;

        for (const mt of mts) {
            const subs = (mt.subtasks || []).filter(s => (s.title || '').trim() !== '');

            if (subs.length > 0) {
                totalItems += subs.length;
                for (const s of subs) {
                    if (isSubtaskComplete(s)) completedItems += 1;
                }
            } else if ((mt.title || '').trim() !== '') {
                totalItems += 1;
                const st = (mt.status || '').toLowerCase();
                if (st === 'completed' || st === 'published') {
                    completedItems += 1;
                }
            }
        }

        return totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100);
    }

    if (departmentName === 'Marketing') {
        if (!plan.tasks || plan.tasks.length === 0) return 0;

        // Find main tasks and their indices
        const mainTasks = [];
        const mainTaskIndices = [];
        plan.tasks.forEach((t, idx) => {
            const isSubtask = !!t._isSubtask || (t.product === '' && (t.mediaType !== '' || t.mainGoal !== ''));
            if (isSubtask) return;

            const isValid = (t.product && t.product.trim()) || 
                            (t.mainGoal && t.mainGoal.trim()) || 
                            (t.description && t.description.trim()) || 
                            (t.marketingChannel && t.marketingChannel.trim());
            if (isValid) {
                mainTasks.push(t);
                mainTaskIndices.push(idx);
            }
        });

        if (mainTasks.length === 0) return 0;

        let sumPct = 0;
        mainTasks.forEach((t, i) => {
            const mainTaskIdx = mainTaskIndices[i];
            const isRowCompleted = t.done || (t.status || '').toLowerCase() === 'completed' || (t.status || '').toLowerCase() === 'published';
            if (isRowCompleted) {
                sumPct += 100;
                return;
            }

            let totalSub = 0;
            let doneSub = 0;
            for (let sidx = mainTaskIdx + 1; sidx < plan.tasks.length; sidx++) {
                const st = plan.tasks[sidx];
                const isSt = !!st._isSubtask || (st.product === '' && (st.mediaType !== '' || st.mainGoal !== ''));
                if (!isSt) break;
                totalSub++;
                if (st.done || (st.status || '').toLowerCase() === 'completed' || (st.status || '').toLowerCase() === 'published') {
                    doneSub++;
                }
            }

            if (totalSub > 0) {
                sumPct += Math.round((doneSub / totalSub) * 100);
            }
        });

        return Math.round(sumPct / mainTasks.length);
    }

    if (!plan.tasks || plan.tasks.length === 0) return 0;

    // Strict filter: only count tasks that have actual content in key fields
    const validTasks = plan.tasks.filter(task =>
        (task.product && task.product.trim()) || 
        (task.mainGoal && task.mainGoal.trim()) || 
        (task.description && task.description.trim()) || 
        (task.marketingChannel && task.marketingChannel.trim())
    );

    if (validTasks.length === 0) return 0;

    const completedTasks = validTasks.filter(task => {
        const status = (task.status || '').toLowerCase();
        return status === 'completed' || status === 'published' || task.done === true;
    });

    return Math.round((completedTasks.length / validTasks.length) * 100);
};

// Get all departments with their current progress
router.get('/', authMiddleware, async (req, res) => {
    try {
        const departments = await Department.find().lean();
        
        // Single optimized query with projection
        const allPlans = await Plan.find({}, 'department tasks.product tasks.mainGoal tasks.description tasks.marketingChannel tasks.status tasks.done rdMainTasks.title rdMainTasks.status rdMainTasks.subtasks.title rdMainTasks.subtasks.status rdMainTasks.subtasks.isDone').lean();

        // Group plans by department ID
        const plansByDept = {};
        for (const plan of allPlans) {
            const deptId = plan.department.toString();
            if (!plansByDept[deptId]) plansByDept[deptId] = [];
            plansByDept[deptId].push(plan);
        }
        
        for (const dept of departments) {
            const plans = plansByDept[dept._id.toString()] || [];

            if (plans.length > 0) {
                const totalProgress = plans.reduce((sum, plan) => {
                    return sum + calculatePlanPercentage(plan, dept.name);
                }, 0);

                dept.completionPercent = Math.round(totalProgress / plans.length);
            } else {
                dept.completionPercent = 0;
            }
        }
        
        res.json(departments);
    } catch (err) {
        console.error('Error fetching departments with progress:', err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;


