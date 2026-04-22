const express = require('express');
const Department = require('../models/Department');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Get all departments
router.get('/', authMiddleware, async (req, res) => {
    try {
        const departments = await Department.find();
        res.json(departments);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
