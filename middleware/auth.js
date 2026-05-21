const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { isAdminRole, isDepartmentHeadRole, isViewOnlyRole, canViewAdminArea } = require('../utils/roles');

const authMiddleware = async (req, res, next) => {
    let token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        token = req.header('x-auth-token');
    }

    if (!token) {
        // Never impersonate in production — breaks real auth and confuses /api/auth/me in hosted apps.
        if (process.env.NODE_ENV !== 'production' && process.env.AUTH_DEV_NO_TOKEN_BYPASS === 'true') {
            const sadmin = await User.findOne({ username: 'sadmin' });
            if (sadmin) {
                req.user = {
                    id: sadmin._id,
                    role: sadmin.role,
                    department: sadmin.department,
                    username: sadmin.username,
                    fullName: sadmin.fullName,
                    email: sadmin.email,
                    status: sadmin.status
                };
                return next();
            }
        }
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        return res.status(401).json({ message: 'Token is not valid' });
    }

    try {
        const user = await User.findById(decoded.id).select('-password');
        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        if (user.status === 'Inactive') {
            return res.status(403).json({ message: 'Account is inactive' });
        }

        req.user = {
            id: user._id,
            role: user.role,
            department: user.department,
            username: user.username,
            fullName: user.fullName,
            email: user.email,
            status: user.status
        };
        next();
    } catch (err) {
        console.error('authMiddleware user lookup failed:', err);
        return res.status(500).json({ message: 'Authentication service unavailable' });
    }
};

const roleMiddleware = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied' });
        }
        next();
    };
};

/** Only system admins may manage users and global settings. */
const requireAdmin = (req, res, next) => {
    if (!canViewAdminArea(req.user)) {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
};

// Admin: full access (unless scoped). Department heads: own department only. Users: no mutations.
const departmentEditMiddleware = async (req, res, next) => {
    try {
        if (isViewOnlyRole(req.user.role)) {
            return res.status(403).json({
                message: 'Access denied: You have read-only access and cannot create, edit, or delete plans.'
            });
        }

        const Department = require('../models/Department');
        const Plan = require('../models/Plan');

        let targetDepartment = null;
        const body = req.body || {};

        if (body.department) {
            targetDepartment = await Department.findById(body.department);
            if (!targetDepartment) {
                return res.status(404).json({ message: 'Department not found' });
            }
        }

        if (req.params.id && !targetDepartment) {
            const plan = await Plan.findById(req.params.id);
            if (!plan) {
                return res.status(404).json({ message: 'Plan not found' });
            }
            targetDepartment = await Department.findById(plan.department);
            if (!targetDepartment) {
                return res.status(404).json({ message: 'Department not found' });
            }
        }

        // If user is restricted to a specific department, enforce it (EVEN FOR ADMINS)
        if (req.user.department) {
            if (targetDepartment) {
                if (req.user.department !== targetDepartment.name) {
                    return res.status(403).json({
                        message: `Access denied: You can only edit plans for ${req.user.department} department`
                    });
                }
            }
        } else {
            // If they are NOT restricted to a department, they must be an Admin or DeptHead to edit globally
            if (!isAdminRole(req.user.role) && !isDepartmentHeadRole(req.user.role)) {
                return res.status(403).json({ message: 'Access denied' });
            }
        }

        next();
    } catch (err) {
        console.error('Department edit middleware error:', err);
        res.status(500).json({ message: err.message });
    }
};

module.exports = {
    authMiddleware,
    roleMiddleware,
    requireAdmin,
    departmentEditMiddleware
};
