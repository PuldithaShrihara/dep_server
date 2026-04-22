const express = require('express');
const mongoose = require('mongoose');
const NewEmployeeEntry = require('../models/NewEmployeeEntry');
const { authMiddleware, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);
router.use(requireAdmin);

function parseMonthYear(req) {
    const month = parseInt(req.query.month ?? req.body?.month, 10);
    const year = parseInt(req.query.year ?? req.body?.year, 10);
    if (!Number.isFinite(month) || month < 1 || month > 12) return { error: 'Invalid or missing month (1-12)' };
    if (!Number.isFinite(year) || year < 2000 || year > 2100) return { error: 'Invalid or missing year' };
    return { month, year };
}

router.get('/', async (req, res) => {
    try {
        const parsed = parseMonthYear(req);
        if (parsed.error) return res.status(400).json({ message: parsed.error });

        const docs = await NewEmployeeEntry.find({ month: parsed.month, year: parsed.year })
            .sort({ sortOrder: 1, createdAt: 1 })
            .lean();

        return res.json({
            entries: docs.map((d) => ({
                id: String(d._id),
                fullName: d.fullName || '',
                nameWithInitial: d.nameWithInitial || '',
                nic: d.nic || '',
                dob: d.dob || '',
                department: d.department || '',
                contactNo: d.contactNo || '',
                remarks: d.remarks || '',
                sortOrder: d.sortOrder || 0
            }))
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: err.message });
    }
});

router.post('/save', async (req, res) => {
    try {
        const parsed = parseMonthYear(req);
        if (parsed.error) return res.status(400).json({ message: parsed.error });

        const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
        await NewEmployeeEntry.deleteMany({ month: parsed.month, year: parsed.year });

        const insertDocs = entries.map((e, i) => ({
            month: parsed.month,
            year: parsed.year,
            fullName: String(e?.fullName || ''),
            nameWithInitial: String(e?.nameWithInitial || ''),
            nic: String(e?.nic || ''),
            dob: String(e?.dob || ''),
            department: String(e?.department || ''),
            contactNo: String(e?.contactNo || ''),
            remarks: String(e?.remarks || ''),
            sortOrder: Number.isFinite(e?.sortOrder) ? e.sortOrder : i
        }));

        if (insertDocs.length > 0) {
            await NewEmployeeEntry.insertMany(insertDocs);
        }

        const docs = await NewEmployeeEntry.find({ month: parsed.month, year: parsed.year })
            .sort({ sortOrder: 1, createdAt: 1 })
            .lean();

        return res.json({
            entries: docs.map((d) => ({
                id: String(d._id),
                fullName: d.fullName || '',
                nameWithInitial: d.nameWithInitial || '',
                nic: d.nic || '',
                dob: d.dob || '',
                department: d.department || '',
                contactNo: d.contactNo || '',
                remarks: d.remarks || '',
                sortOrder: d.sortOrder || 0
            }))
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: err.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Invalid id' });
        await NewEmployeeEntry.deleteOne({ _id: id });
        return res.json({ ok: true });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: err.message });
    }
});

module.exports = router;

