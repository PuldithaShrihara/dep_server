const mongoose = require('mongoose');

const insuranceEntrySchema = new mongoose.Schema(
    {
        namespace: { type: String, required: true, index: true }, // e.g. 'life' | 'general'
        categoryKey: { type: String, required: true, index: true }, // e.g. 'policyRenewal'
        month: { type: Number, required: true, min: 1, max: 12, index: true },
        year: { type: Number, required: true, min: 2000, max: 2100, index: true },

        fullName: { type: String, required: true, trim: true },
        email: { type: String, default: '', trim: true },
        phone: { type: String, default: '', trim: true },
        department: { type: String, default: '', trim: true },

        status: { type: String, default: 'In Progress', trim: true },
        assignedDate: { type: String, default: '', trim: true }, // ISO date string (YYYY-MM-DD)
        observedById: { type: mongoose.Schema.Types.ObjectId, ref: 'HrMember', default: null },
        observedByName: { type: String, default: '', trim: true },
        remarks: { type: String, default: '', trim: true },

        completed: { type: Boolean, default: false, index: true },
        completedDate: { type: String, default: '', trim: true }
    },
    { timestamps: true }
);

module.exports = mongoose.model('InsuranceEntry', insuranceEntrySchema);

