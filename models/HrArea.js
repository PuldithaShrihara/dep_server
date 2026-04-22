const mongoose = require('mongoose');

const HR_CATEGORIES = ['People & HR', 'Finance', 'Operations', 'Vehicle'];
const HR_FREQUENCIES = ['Monthly', 'Annual', 'Ongoing'];

const hrAreaSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        category: { type: String, required: true, enum: HR_CATEGORIES },
        frequency: { type: String, required: true, enum: HR_FREQUENCIES },
        sortOrder: { type: Number, default: 0 }
    },
    { timestamps: true }
);

hrAreaSchema.index({ title: 1 }, { unique: true });

module.exports = mongoose.model('HrArea', hrAreaSchema);
module.exports.HR_CATEGORIES = HR_CATEGORIES;
module.exports.HR_FREQUENCIES = HR_FREQUENCIES;
