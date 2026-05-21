const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const Product = require('../models/Product');
const Plan = require('../models/Plan');
const { authMiddleware } = require('../middleware/auth');

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const uploadDir = path.join(__dirname, '..', 'uploads', 'products');
            fs.mkdirSync(uploadDir, { recursive: true });
            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            const safeName = `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`;
            cb(null, safeName);
        }
    }),
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed'));
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
        const { departmentId } = req.query;
        const filter = departmentId ? { departmentId } : {};
        const products = await Product.find(filter).sort({ createdAt: -1 });
        res.json(products);
    } catch (err) {
        console.error('Error fetching products:', err);
        res.status(500).json({ message: err.message });
    }
});

router.post('/', authMiddleware, upload.single('image'), async (req, res) => {
    try {
        const fs = require('fs');
        fs.appendFileSync('post_log.txt', JSON.stringify({ body: req.body, file: req.file ? req.file.originalname : null }) + '\n');
        
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const { name, description = '', category = '', planId, departmentId } = body;
        const imagePath = req.file ? `/uploads/products/${req.file.filename}` : '';

        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'Product name is required' });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'Please upload a product image.' });
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
            imageUrl: imagePath,
            createdInPlanId: planId || null,
            planId: planId || null,
            departmentId: finalDeptId
        });

        const savedProduct = await product.save();

        if (finalDeptId) {
            await Plan.updateMany(
                { department: finalDeptId },
                { $addToSet: { products: savedProduct._id } }
            );
        }

        res.status(201).json(savedProduct);
    } catch (err) {
        console.error('Error creating product:', err);
        res.status(400).json({ message: err.message });
    }
});

module.exports = router;
