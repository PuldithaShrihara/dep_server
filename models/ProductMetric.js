const mongoose = require('mongoose');

const productMetricSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    month: { type: String, required: true },
    year: { type: Number, required: true },
    monthlyBudget: { type: String, default: null },
    monthlyTarget: { type: Number, default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Compound unique index to enforce one record per product/month/year
productMetricSchema.index({ productId: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('ProductMetric', productMetricSchema);
