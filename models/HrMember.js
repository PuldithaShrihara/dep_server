const mongoose = require('mongoose');

const hrMemberSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        role: { type: String, required: true, trim: true },
        sortOrder: { type: Number, default: 0 }
    },
    { timestamps: true }
);

hrMemberSchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model('HrMember', hrMemberSchema);
