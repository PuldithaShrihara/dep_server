const express = require('express');
const Department = require('../models/Department');
const Plan = require('../models/Plan');
const HrTask = require('../models/HrTask');
const HrCompletion = require('../models/HrCompletion');
const { authMiddleware } = require('../middleware/auth');
const { migrateLegacyRdTasksToNested, isSubtaskComplete } = require('../utils/rdTasks');

const router = express.Router();

const monthToNum = (m) => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const idx = months.indexOf(m);
    return idx !== -1 ? idx + 1 : 0;
};

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
        
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        for (const dept of departments) {
            if (dept.name === 'Admin') {
                const total = await HrTask.countDocuments();
                // Try current month first
                let completed = await HrCompletion.countDocuments({ 
                    month: currentMonth, 
                    year: currentYear 
                });
                
                // If current month is empty, find the latest month with data
                if (completed === 0 && total > 0) {
                    const latest = await HrCompletion.findOne().sort({ year: -1, month: -1 });
                    if (latest) {
                        completed = await HrCompletion.countDocuments({
                            month: latest.month,
                            year: latest.year
                        });
                    }
                }
                
                dept.completionPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
            } else {
                // Fetch all plans and sort them correctly
                const plans = await Plan.find({ department: dept._id }).lean();
                
                if (plans.length > 0) {
                    plans.sort((a, b) => {
                        if (a.year !== b.year) return b.year - a.year;
                        const ma = monthToNum(a.month);
                        const mb = monthToNum(b.month);
                        if (ma !== mb) return mb - ma;
                        return new Date(b.updatedAt) - new Date(a.updatedAt);
                    });

                    // Find the first plan that actually has data
                    let planToUse = null;
                    for (const p of plans) {
                        const hasData = p.tasks.some(t => 
                            (t.product && t.product.trim()) || 
                            (t.mainGoal && t.mainGoal.trim()) || 
                            (t.description && t.description.trim())
                        );
                        if (hasData) {
                            planToUse = p;
                            break;
                        }
                    }

                    // Fallback to latest chronological if all are empty
                    if (!planToUse) planToUse = plans[0];
                    
                    dept.completionPercent = calculatePlanPercentage(planToUse, dept.name);
                } else {
                    dept.completionPercent = 0;
                }
            }
        }
        
        res.json(departments);
    } catch (err) {
        console.error('Error fetching departments with progress:', err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;


