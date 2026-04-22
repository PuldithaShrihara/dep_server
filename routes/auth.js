const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { validatePassword } = require('../utils/passwordPolicy');

const router = express.Router();

function userPublicFields(user) {
    return {
        id: user._id,
        username: user.username,
        role: user.role,
        department: user.department,
        fullName: user.fullName || '',
        email: user.email || '',
        status: user.status || 'Active'
    };
}

// Secured: only admins can call legacy register (prefer POST /api/users).
router.post('/register', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { username, password, role, department, fullName, email, status } = req.body;
        const pwdErr = validatePassword(password);
        if (pwdErr) return res.status(400).json({ message: pwdErr });

        const hashedPassword = await bcrypt.hash(password, 10);
        const doc = await User.create({
            username,
            password: hashedPassword,
            role: role || 'User',
            department: department || null,
            fullName: fullName || '',
            email: email ? String(email).trim().toLowerCase() : undefined,
            status: status === 'Inactive' ? 'Inactive' : 'Active'
        });
        const out = doc.toObject();
        delete out.password;
        res.status(201).json({ message: 'User created', user: out });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ message: 'Username or email already exists' });
        }
        res.status(500).json({ message: err.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (user.status === 'Inactive') {
            return res.status(403).json({ message: 'Account is inactive' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        const token = jwt.sign(
            {
                id: user._id,
                role: user.role,
                department: user.department
            },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({
            token,
            user: userPublicFields(user)
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(userPublicFields(user));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
