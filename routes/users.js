const express = require('express');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { validatePassword } = require('../utils/passwordPolicy');
const { DEPARTMENT_HEAD_ROLES } = require('../utils/roles');
const { DEPARTMENT_NAMES } = require('../constants/departments');
const { seedDefaultUsers } = require('../utils/seedDefaultUsers');

const router = express.Router();

const API_ROLES = ['Admin', 'DepartmentHead', 'User'];

function normalizeEmail(email) {
    if (email === undefined || email === null) return undefined;
    const t = String(email).trim().toLowerCase();
    return t === '' ? undefined : t;
}

async function ensureSingleDepartmentHead(department, excludeId, allowMultiple) {
    if (allowMultiple || !department) return;
    const filter = {
        department,
        role: { $in: DEPARTMENT_HEAD_ROLES },
        status: 'Active'
    };
    if (excludeId) filter._id = { $ne: excludeId };
    const other = await User.findOne(filter);
    if (other) {
        const err = new Error(`An active department head already exists for ${department}`);
        err.status = 400;
        throw err;
    }
}

function validateDepartmentForRole(role, department) {
    // If department is null/empty, it means "All Departments" (Global Access)
    if (!department || department === 'All Departments') {
        return;
    }

    if (role === 'Admin') {
        // Admin usually has no specific department, but if one is provided, we'll allow it 
        // as a primary focus while keeping global access in the auth middleware.
        return;
    }

    if (!DEPARTMENT_NAMES.includes(department)) {
        const err = new Error(`A valid department is required (${DEPARTMENT_NAMES.join(', ')})`);
        err.status = 400;
        throw err;
    }
}

// All routes: authenticated admin only
router.use(authMiddleware, requireAdmin);

router.get('/', async (req, res) => {
    try {
        const { department, role, status } = req.query;
        const filter = {};
        if (department && department !== 'all') filter.department = department;
        if (role && role !== 'all') {
            if (role === 'DepartmentHead') {
                filter.role = { $in: DEPARTMENT_HEAD_ROLES };
            } else if (API_ROLES.includes(role)) {
                filter.role = role;
            }
        }
        if (status && status !== 'all') filter.status = status;

        const users = await User.find(filter)
            .select('-password')
            .sort({ role: 1, username: 1 })
            .lean();

        res.json(users);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Must stay before "/:id" routes that could treat the segment as an ObjectId.
router.post('/seed-defaults', async (req, res) => {
    try {
        const summary = await seedDefaultUsers();
        res.json({
            message: 'Default accounts created or updated',
            ...summary
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid user id' });
        }
        const user = await User.findById(req.params.id).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const {
            fullName,
            username,
            email,
            password,
            confirmPassword,
            role,
            department,
            status,
            allowMultipleDepartmentHeads
        } = req.body;

        if (!API_ROLES.includes(role)) {
            return res.status(400).json({ message: 'Invalid role' });
        }

        const pwd = password;
        if (!pwd || (confirmPassword !== undefined && pwd !== confirmPassword)) {
            return res.status(400).json({ message: 'Password and confirm password must match' });
        }
        const pwdErr = validatePassword(pwd);
        if (pwdErr) return res.status(400).json({ message: pwdErr });

        const dept = (department === 'All Departments' || !department) ? null : department;
        try {
            validateDepartmentForRole(role, dept);
        } catch (e) {
            return res.status(e.status || 400).json({ message: e.message });
        }

        const emailNorm = normalizeEmail(email);
        if (emailNorm) {
            const taken = await User.findOne({ email: emailNorm });
            if (taken) return res.status(400).json({ message: 'Email is already in use' });
        }

        const uname = String(username || '').trim();
        if (!uname) return res.status(400).json({ message: 'Username is required' });

        const exists = await User.findOne({ username: uname });
        if (exists) return res.status(400).json({ message: 'Username already exists' });

        if (role === 'DepartmentHead') {
            try {
                await ensureSingleDepartmentHead(dept, null, !!allowMultipleDepartmentHeads);
            } catch (e) {
                return res.status(e.status || 400).json({ message: e.message });
            }
        }

        const hashedPassword = await bcrypt.hash(pwd, 10);
        const doc = await User.create({
            fullName: (fullName && String(fullName).trim()) || '',
            username: uname,
            email: emailNorm,
            password: hashedPassword,
            role,
            department: dept,
            status: status === 'Inactive' ? 'Inactive' : 'Active'
        });

        const out = doc.toObject();
        delete out.password;
        res.status(201).json(out);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ message: 'Username or email already exists' });
        }
        res.status(500).json({ message: err.message });
    }
});

router.patch('/:id', async (req, res) => {
    try {
        const id = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid user id' });
        }

        if (String(id) === String(req.user.id)) {
            const bodyKeys = Object.keys(req.body || {});
            const risky = bodyKeys.some((k) => ['role', 'status', 'department'].includes(k));
            if (risky) {
                return res.status(400).json({ message: 'You cannot change your own role, department, or status here' });
            }
        }

        const user = await User.findById(id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const {
            fullName,
            username,
            email,
            password,
            confirmPassword,
            role,
            department,
            status,
            allowMultipleDepartmentHeads
        } = req.body;

        let nextRole = user.role;
        let nextDept = user.department;
        let nextStatus = user.status;

        if (fullName !== undefined) user.fullName = String(fullName).trim();
        if (username !== undefined) {
            const uname = String(username).trim();
            if (!uname) return res.status(400).json({ message: 'Username is required' });
            const taken = await User.findOne({ username: uname, _id: { $ne: user._id } });
            if (taken) return res.status(400).json({ message: 'Username already exists' });
            user.username = uname;
        }

        if (email !== undefined) {
            const emailNorm = normalizeEmail(email);
            if (emailNorm) {
                const taken = await User.findOne({ email: emailNorm, _id: { $ne: user._id } });
                if (taken) return res.status(400).json({ message: 'Email is already in use' });
                user.email = emailNorm;
            } else {
                user.email = undefined;
            }
        }

        if (role !== undefined) {
            if (!API_ROLES.includes(role)) {
                return res.status(400).json({ message: 'Invalid role' });
            }
            nextRole = role;
        }
        if (department !== undefined) {
            nextDept = department === '' || department === null ? null : department;
        }
        if (status !== undefined) {
            if (!['Active', 'Inactive'].includes(status)) {
                return res.status(400).json({ message: 'Invalid status' });
            }
            nextStatus = status;
        }

        try {
            const normalizedDept = (nextDept === 'All Departments' || !nextDept) ? null : nextDept;
            validateDepartmentForRole(nextRole, normalizedDept);
            nextDept = normalizedDept; // Apply normalization
        } catch (e) {
            return res.status(e.status || 400).json({ message: e.message });
        }

        if (nextRole === 'DepartmentHead' && nextStatus === 'Active') {
            try {
                await ensureSingleDepartmentHead(nextDept, user._id, !!allowMultipleDepartmentHeads);
            } catch (e) {
                return res.status(e.status || 400).json({ message: e.message });
            }
        }

        user.role = nextRole;
        user.department = nextRole === 'Admin' ? null : nextDept;
        user.status = nextStatus;

        if (password) {
            if (confirmPassword !== undefined && password !== confirmPassword) {
                return res.status(400).json({ message: 'Password and confirm password must match' });
            }
            const pwdErr = validatePassword(password);
            if (pwdErr) return res.status(400).json({ message: pwdErr });
            user.password = await bcrypt.hash(password, 10);
        }

        await user.save();
        const out = user.toObject();
        delete out.password;
        res.json(out);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ message: 'Username or email already exists' });
        }
        res.status(500).json({ message: err.message });
    }
});

router.post('/:id/reset-password', async (req, res) => {
    try {
        const id = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid user id' });
        }

        const { newPassword, confirmPassword } = req.body;
        if (!newPassword || newPassword !== confirmPassword) {
            return res.status(400).json({ message: 'New password and confirmation must match' });
        }
        const pwdErr = validatePassword(newPassword);
        if (pwdErr) return res.status(400).json({ message: pwdErr });

        const user = await User.findById(id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();
        res.json({ message: 'Password reset successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const id = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid user id' });
        }
        if (String(id) === String(req.user.id)) {
            return res.status(400).json({ message: 'You cannot delete your own account' });
        }

        const user = await User.findByIdAndDelete(id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json({ message: 'User deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
