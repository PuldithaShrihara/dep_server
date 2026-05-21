const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, default: '' },
    category: { type: String, default: '' },
    image: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', default: null },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
