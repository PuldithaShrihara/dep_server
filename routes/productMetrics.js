const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { departmentEditMiddleware } = require('../middleware/departmentAuth');
const ProductMetric = require('../models/ProductMetric');
const Product = require('../models/Product');

// GET /api/products/metrics
// Fetch metrics for all products for a specific month and year
router.get('/metrics', authMiddleware, async (req, res) => {
    try {
        const { month, year } = req.query;
        if (!month || !year) {
            return res.status(400).json({ message: 'Month and year are required' });
        }

        const metrics = await ProductMetric.find({ month, year: Number(year) });
        res.json(metrics);
    } catch (err) {
        console.error('Error fetching product metrics:', err);
        res.status(500).json({ message: 'Server error fetching product metrics' });
    }
});

// GET /api/products/:productId/metrics
// Fetch metrics for a specific product for a specific month and year
router.get('/:productId/metrics', authMiddleware, async (req, res) => {
    try {
        const { month, year } = req.query;
        if (!month || !year) {
            return res.status(400).json({ message: 'Month and year are required' });
        }

        const metric = await ProductMetric.findOne({ 
            productId: req.params.productId, 
            month, 
            year: Number(year) 
        });
        
        // Return empty metric object instead of 404 so frontend can easily bind to it
        res.json(metric || { monthlyBudget: '', monthlyTarget: '' });
    } catch (err) {
        console.error('Error fetching product metric:', err);
        res.status(500).json({ message: 'Server error fetching product metric' });
    }
});

// PUT /api/products/:productId/metrics
// Upsert metrics for a specific product
router.put('/:productId/metrics', authMiddleware, departmentEditMiddleware, async (req, res) => {
    try {
        const { month, year, monthlyBudget, monthlyTarget } = req.body;
        
        if (!month || !year) {
            return res.status(400).json({ message: 'Month and year are required' });
        }

        // Validate product exists
        const product = await Product.findById(req.params.productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Validate non-negative numbers for budget and target if they exist
        const validateNonNegative = (val) => {
            if (val === '' || val === null || val === undefined) return true;
            const num = Number(String(val).replace(/[^0-9.-]+/g, ""));
            return isNaN(num) || num >= 0;
        };

        if (!validateNonNegative(monthlyBudget)) {
            return res.status(400).json({ message: 'Monthly Budget cannot be negative' });
        }
        if (!validateNonNegative(monthlyTarget)) {
            return res.status(400).json({ message: 'Monthly Target cannot be negative' });
        }

        const metric = await ProductMetric.findOneAndUpdate(
            { 
                productId: req.params.productId, 
                month, 
                year: Number(year) 
            },
            {
                $set: {
                    monthlyBudget: monthlyBudget || '',
                    monthlyTarget: monthlyTarget || '',
                    updatedBy: req.user.id
                }
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        res.json(metric);
    } catch (err) {
        console.error('Error updating product metrics:', err);
        res.status(500).json({ message: 'Server error updating product metrics' });
    }
});

module.exports = router;
