const express = require('express');
const ResignedEmployeeEntry = require('../models/ResignedEmployeeEntry');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Get all entries for a specific month/year
router.get('/entries', authMiddleware, async (req, res) => {
    try {
        const { month, year } = req.query;
        const entries = await ResignedEmployeeEntry.find({
            month: parseInt(month),
            year: parseInt(year)
        }).sort({ createdAt: 1 });
        
        res.json(entries);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Create or update an entry
router.post('/entry', authMiddleware, async (req, res) => {
    try {
        const { month, year, entry } = req.body;
        
        let savedEntry;
        if (entry._id || entry.id) {
            savedEntry = await ResignedEmployeeEntry.findByIdAndUpdate(
                entry._id || entry.id,
                { ...entry, month, year },
                { returnDocument: 'after' }
            );
        } else {
            savedEntry = new ResignedEmployeeEntry({ ...entry, month, year });
            await savedEntry.save();
        }
        
        res.json({ entry: savedEntry });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Delete an entry
router.delete('/entry/:id', authMiddleware, async (req, res) => {
    try {
        await ResignedEmployeeEntry.findByIdAndDelete(req.params.id);
        res.json({ message: 'Entry deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
