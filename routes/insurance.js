const express = require('express');
const mongoose = require('mongoose');
const HrMember = require('../models/HrMember');
const InsuranceEntry = require('../models/InsuranceEntry');
const { authMiddleware, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);
router.use(requireAdmin);

function parseMonthYear(req) {
    const month = parseInt(req.query.month, 10);
    const year = parseInt(req.query.year, 10);
    if (!Number.isFinite(month) || month < 1 || month > 12) return { error: 'Invalid or missing month (1-12)' };
    if (!Number.isFinite(year) || year < 2000 || year > 2100) return { error: 'Invalid or missing year' };
    return { month, year };
}

router.get('/entries', async (req, res) => {
    try {
        const { error, month, year } = parseMonthYear(req);
        if (error) return res.status(400).json({ message: error });

        const namespace = String(req.query.namespace || '').trim();
        if (!namespace) return res.status(400).json({ message: 'Missing namespace' });

        const rows = await InsuranceEntry.find({ namespace, month, year }).lean();
        const entriesByTab = {};
        for (const r of rows) {
            const key = r.categoryKey;
            if (!entriesByTab[key]) entriesByTab[key] = [];
            entriesByTab[key].push({
                id: String(r._id),
                fullName: r.fullName,
                email: r.email || '',
                phone: r.phone || '',
                department: r.department || '',
                status: r.status || 'In Progress',
                assignedDate: r.assignedDate || '',
                observedById: r.observedById ? String(r.observedById) : '',
                observedByName: r.observedByName || '',
                remarks: r.remarks || '',
                completed: Boolean(r.completed),
                completedDate: r.completedDate || ''
            });
        }

        res.json({ entriesByTab });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

router.post('/entry', async (req, res) => {
    try {
        const month = Number(req.body.month ?? req.query.month);
        const year = Number(req.body.year ?? req.query.year);
        if (!Number.isFinite(month) || month < 1 || month > 12) return res.status(400).json({ message: 'Invalid or missing month (1-12)' });
        if (!Number.isFinite(year) || year < 2000 || year > 2100) return res.status(400).json({ message: 'Invalid or missing year' });

        const namespace = String(req.body.namespace || '').trim();
        const categoryKey = String(req.body.categoryKey || '').trim();
        if (!namespace) return res.status(400).json({ message: 'Missing namespace' });
        if (!categoryKey) return res.status(400).json({ message: 'Missing categoryKey' });

        const payload = req.body.entry || {};
        const payloadId = payload.id ? String(payload.id) : null;
        // Client may send fake ids like "ins-12345" for new rows.
        // Only treat ids as update-ids when they are valid Mongo ObjectIds.
        const entryId = payloadId && mongoose.Types.ObjectId.isValid(payloadId) ? payloadId : null;

        // Optional observer name normalization
        let observedByName = String(payload.observedByName || '').trim();
        if (!observedByName && payload.observedById) {
            const m = await HrMember.findById(payload.observedById).lean();
            observedByName = m?.name || '';
        }

        const completed = Boolean(payload.completed);
        const completedDate = completed ? String(payload.completedDate || '') : '';

        const data = {
            namespace,
            categoryKey,
            month,
            year,
            fullName: String(payload.fullName || '').trim(),
            email: String(payload.email || '').trim(),
            phone: String(payload.phone || '').trim(),
            department: String(payload.department || '').trim(),
            status: String(payload.status || 'In Progress'),
            assignedDate: String(payload.assignedDate || '').trim(),
            observedById: payload.observedById || null,
            observedByName,
            remarks: String(payload.remarks || ''),
            completed,
            completedDate
        };

        if (!data.fullName) return res.status(400).json({ message: 'Name is required' });
        if (!data.assignedDate) return res.status(400).json({ message: 'Assigned date is required' });
        if (!data.status) return res.status(400).json({ message: 'Status is required' });

        let saved;
        if (entryId) {
            saved = await InsuranceEntry.findByIdAndUpdate(
                entryId,
                data,
                { returnDocument: 'after' }
            ).lean();
        } else {
            saved = await InsuranceEntry.create(data);
            saved = saved.toObject ? saved.toObject() : saved;
        }

        res.json({
            ok: true,
            entry: saved
                ? {
                      id: String(saved._id),
                      fullName: saved.fullName,
                      email: saved.email || '',
                      phone: saved.phone || '',
                      department: saved.department || '',
                      status: saved.status || 'In Progress',
                      assignedDate: saved.assignedDate || '',
                      observedById: saved.observedById ? String(saved.observedById) : '',
                      observedByName: saved.observedByName || '',
                      remarks: saved.remarks || '',
                      completed: Boolean(saved.completed),
                      completedDate: saved.completedDate || ''
                  }
                : null
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

router.delete('/entry/:id', async (req, res) => {
    try {
        const id = req.params.id;
        if (!id) return res.status(400).json({ message: 'Missing id' });

        await InsuranceEntry.findByIdAndDelete(id);
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;

