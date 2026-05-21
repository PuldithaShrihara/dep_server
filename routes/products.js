const express = require('express');
const path = require('path');
const multer = require('multer');
const Product = require('../models/Product');
const Plan = require('../models/Plan');
const { authMiddleware } = require('../middleware/auth');

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
        filename: (req, file, cb) => {
            const safeName = `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`;
            cb(null, safeName);
        }
    }),
    fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'image/png') {
            return cb(new Error('Only PNG files are allowed'));
        }
        cb(null, true);
    }
});

const router = express.Router();

function logRequestDebug(req) {
    console.log('METHOD:', req.method);
    console.log('URL:', req.originalUrl);
    console.log('CONTENT TYPE:', req.headers['content-type']);
    console.log('BODY:', req.body);
    console.log('FILE:', req.file);
}

router.get('/', authMiddleware, async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });
        res.json(products);
    } catch (err) {
        console.error('Error fetching products:', err);
        res.status(500).json({ message: err.message });
    }
});

router.post('/', authMiddleware, upload.single('image'), async (req, res) => {
    console.log('PRODUCT ROUTE HIT');
    logRequestDebug(req);

    try {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        if (!req.body || typeof req.body !== 'object') {
            console.warn('WARN /api/products received invalid req.body:', req.body);
        }
        const { name, description = '', category = '', imageUrl = '', image = '', planId, departmentId } = body;
        const imagePath = req.file ? `/uploads/${req.file.filename}` : imageUrl || image || '';

        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'Product name is required' });
        }

        let linkedPlan = null;
        if (planId) {
            linkedPlan = await Plan.findById(planId);
            if (!linkedPlan) {
                return res.status(404).json({ message: 'Plan not found' });
            }
        }

        const product = new Product({
            name: name.trim(),
            description: description || '',
            category: category || '',
            image: imagePath,
            planId: planId || null,
            departmentId: departmentId || linkedPlan?.department || null
        });

        const savedProduct = await product.save();

        if (linkedPlan) {
            linkedPlan.products.push({
                productId: savedProduct._id,
                name: savedProduct.name,
                description: savedProduct.description,
                image: savedProduct.image,
                category: savedProduct.category
            });
            await linkedPlan.save();
        }

        res.status(201).json(savedProduct);
    } catch (err) {
        console.error('Error creating product:', err);
        res.status(400).json({ message: err.message });
    }
});

module.exports = router;
