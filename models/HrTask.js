const mongoose = require('mongoose');

const hrTaskSchema = new mongoose.Schema(
    {
        area: { type: mongoose.Schema.Types.ObjectId, ref: 'HrArea', required: true },
        label: { type: String, required: true, trim: true },
        subLabel: { type: String, default: '', trim: true },
        sortOrder: { type: Number, default: 0 }
    },
    { timestamps: true }
);

hrTaskSchema.index({ area: 1, label: 1 }, { unique: true });

module.exports = mongoose.model('HrTask', hrTaskSchema);
