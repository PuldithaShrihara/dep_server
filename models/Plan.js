const mongoose = require('mongoose');

const rdSubtaskSchema = new mongoose.Schema({
    title: { type: String, default: '' },
    responsible: { type: String, default: '' },
    assignedEmployee: { type: String, default: '' },
    status: { type: String, default: 'planning' },
    remark: { type: String, default: '' },
    startDate: { type: String, default: '' },
    endDate: { type: String, default: '' },
    isDone: { type: Boolean, default: false },
    taskId: { type: mongoose.Schema.Types.ObjectId }
}, { _id: true });

const rdMainTaskSchema = new mongoose.Schema({
    title: { type: String, default: '' },
    status: { type: String, default: 'planning' },
    isManualStatusOverride: { type: Boolean, default: false },
    subtasks: [rdSubtaskSchema]
}, { _id: true });

const planSchema = new mongoose.Schema({
    department: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department',
        required: true
    },
    month: {
        type: String,
        required: true
    },
    year: {
        type: Number,
        required: true
    },
    title: {
        type: String,
        required: true,
        unique: false
    },
    description: {
        type: String
    },
    target: {
        type: String
    },
    status: {
        type: String,
        enum: ['Planned', 'In Progress', 'Completed', 'Cancelled'],
        default: 'Planned'
    },
    tasks: [{
        product: String,
        mediaType: String,
        marketingChannel: String,
        mainGoal: String,
        done: { type: Boolean, default: false },
        description: String,
        outcome: String,
        owner: String,
        status: String,
        priority: String,
        startDate: String,
        endDate: String,
        assets: String,
        notes: String,
        completedBy: String,
        completedTime: String,
        reportTo: String
    }],
    /** R&D nested main tasks with subtasks (parent-child). Legacy flat `tasks` may still exist until migrated. */
    rdMainTasks: {
        type: [rdMainTaskSchema],
        default: undefined
    }
}, { timestamps: true });

module.exports = mongoose.model('Plan', planSchema);
