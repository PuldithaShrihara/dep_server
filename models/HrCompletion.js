const mongoose = require('mongoose');

const hrCompletionSchema = new mongoose.Schema(
    {
        task: { type: mongoose.Schema.Types.ObjectId, ref: 'HrTask', required: true },
        member: { type: mongoose.Schema.Types.ObjectId, ref: 'HrMember', required: true },
        // Who observed/verified the completion (optional). This lets a single task record
        // show both "Completed by" and "Observed by" without creating multiple task completions.
        observedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'HrMember', required: false },
        remarks: { type: String, default: '' },
        completedAt: { type: Date, required: true, default: Date.now },
        month: { type: Number, required: true, min: 1, max: 12 },
        year: { type: Number, required: true, min: 2000, max: 2100 }
    },
    { timestamps: true }
);

hrCompletionSchema.index({ task: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('HrCompletion', hrCompletionSchema);
