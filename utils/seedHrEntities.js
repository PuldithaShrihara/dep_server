const HrMember = require('../models/HrMember');
const HrArea = require('../models/HrArea');
const HrTask = require('../models/HrTask');
const HrCompletion = require('../models/HrCompletion');
const { MEMBERS, AREAS } = require('./hrSeedData');

async function seedHrEntities() {
    const titles = AREAS.map((a) => a.title);

    const orphans = await HrArea.find({ title: { $nin: titles } }).lean();
    for (const o of orphans) {
        const taskIds = await HrTask.find({ area: o._id }).distinct('_id');
        if (taskIds.length) {
            await HrCompletion.deleteMany({ task: { $in: taskIds } });
            await HrTask.deleteMany({ area: o._id });
        }
        await HrArea.deleteOne({ _id: o._id });
    }

    const memberRenames = [
        { from: 'Dr. Hirshani', to: 'Dr. Heshani' },
        { from: 'Chamoditha', to: 'Chamuditha' },
        { from: 'Nayanethara', to: 'Nayanathara' }
    ];
    for (const { from, to } of memberRenames) {
        await HrMember.updateOne({ name: from }, { $set: { name: to } });
    }

    for (const m of MEMBERS) {
        await HrMember.findOneAndUpdate(
            { name: m.name },
            { $set: { role: m.role, sortOrder: m.sortOrder } },
            { upsert: true, returnDocument: 'after' }
        );
    }

    const renamedRecruitment = await HrTask.updateMany(
        { label: 'AI finding candidates' },
        { $set: { label: 'finding candidates' } }
    );
    if (renamedRecruitment.modifiedCount > 0) {
        console.log(
            `✓ Renamed ${renamedRecruitment.modifiedCount} HR task(s): "AI finding candidates" → "finding candidates"`
        );
    }

    const recruitmentArea = await HrArea.findOne({ title: 'Recruitment' }).select('_id').lean();
    if (recruitmentArea) {
        /** Old split rows: "Personal file – …" / "Personal file - …" (not "Personal file management") */
        const legacyPf = await HrTask.find({
            area: recruitmentArea._id,
            // Mongo PCRE2 doesn't accept JS \uXXXX escape sequences inside the regex source.
            // Use the actual dash characters instead of `\u2013`.
            label: { $regex: /^Personal file\s*[–-]\s*.+$/ }
        })
            .select('_id')
            .lean();
        const legacyIds = legacyPf.map((t) => t._id);
        if (legacyIds.length) {
            await HrCompletion.deleteMany({ task: { $in: legacyIds } });
            await HrTask.deleteMany({ _id: { $in: legacyIds } });
            console.log(
                `✓ Removed ${legacyIds.length} legacy split Recruitment task(s) (replaced by "Personal file management")`
            );
        }

        const replacedByCompletingRecruitment = [
            'AU form & welfare document',
            'Orientation & check list',
            'Fingerprint system registration',
            'new recruiments'
        ];
        const closeoutLegacy = await HrTask.find({
            area: recruitmentArea._id,
            label: { $in: replacedByCompletingRecruitment }
        })
            .select('_id')
            .lean();
        const closeoutIds = closeoutLegacy.map((t) => t._id);
        if (closeoutIds.length) {
            await HrCompletion.deleteMany({ task: { $in: closeoutIds } });
            await HrTask.deleteMany({ _id: { $in: closeoutIds } });
            console.log(
                `✓ Removed ${closeoutIds.length} Recruitment close-out task(s) (replaced by "Completing recruiments")`
            );
        }
    }

    const renamedToPersonalFile = await HrTask.updateMany(
        { label: { $in: ['Personal file managing', 'Personal detail management'] } },
        { $set: { label: 'Personal file management' } }
    );
    if (renamedToPersonalFile.modifiedCount > 0) {
        console.log(
            `✓ Renamed ${renamedToPersonalFile.modifiedCount} HR task(s) → "Personal file management"`
        );
    }

    const completingRename = await HrTask.updateMany(
        { label: 'Completing recruitment' },
        { $set: { label: 'Completing recruiments' } }
    );
    if (completingRename.modifiedCount > 0) {
        console.log(
            `✓ Renamed ${completingRename.modifiedCount} task(s) → "Completing recruiments" (seed label)`
        );
    }

    const areaRename = await HrArea.updateOne(
        { title: 'New Recruiments' },
        { $set: { title: 'New Employees', category: 'People & HR', frequency: 'Monthly' } }
    );
    if (areaRename.modifiedCount > 0) {
        console.log('✓ Renamed area "New Recruiments" → "New Employees"');
    }

    let order = 0;
    for (const block of AREAS) {
        const area = await HrArea.findOneAndUpdate(
            { title: block.title },
            {
                $set: {
                    category: block.category,
                    frequency: block.frequency,
                    sortOrder: order++
                }
            },
            { upsert: true, returnDocument: 'after' }
        );

        const labels = block.tasks.map((t) => t.label);
        const staleTasks = await HrTask.find({
            area: area._id,
            label: { $nin: labels }
        })
            .select('_id')
            .lean();
        const staleIds = staleTasks.map((t) => t._id);
        if (staleIds.length) {
            await HrCompletion.deleteMany({ task: { $in: staleIds } });
            await HrTask.deleteMany({ _id: { $in: staleIds } });
        }

        let tOrder = 0;
        for (const t of block.tasks) {
            await HrTask.findOneAndUpdate(
                { area: area._id, label: t.label },
                {
                    $set: {
                        subLabel: t.subLabel || '',
                        sortOrder: tOrder++
                    }
                },
                { upsert: true, returnDocument: 'after' }
            );
        }
    }

    const recruitBlock = AREAS.find((a) => a.title === 'Recruitment');
    const recruitAreaFinal = await HrArea.findOne({ title: 'Recruitment' }).select('_id').lean();
    if (recruitBlock && recruitAreaFinal) {
        const completingIdx = recruitBlock.tasks.findIndex((t) => t.label === 'Completing recruiments');
        if (completingIdx >= 0) {
            const def = recruitBlock.tasks[completingIdx];
            await HrTask.findOneAndUpdate(
                { area: recruitAreaFinal._id, label: def.label },
                {
                    $set: {
                        subLabel: def.subLabel || '',
                        sortOrder: completingIdx
                    }
                },
                { upsert: true, returnDocument: 'after' }
            );
        }
    }

    console.log('✓ HR members, areas, and tasks synced from seed');
    return { seeded: true };
}

/**
 * Upserts Recruitment tasks from seed (no stale delete). Call on GET /areas so partial DBs
 * still get every row after refresh without requiring a full server restart.
 */
async function ensureRecruitmentTasksFromSeed() {
    const block = AREAS.find((a) => a.title === 'Recruitment');
    if (!block) return;
    const area = await HrArea.findOne({ title: 'Recruitment' });
    if (!area) return;

    const canonicalCompleting = 'Completing recruiments';
    const wrongCompleting = await HrTask.findOne({
        area: area._id,
        label: 'Completing recruitment'
    }).lean();
    const rightCompleting = await HrTask.findOne({
        area: area._id,
        label: canonicalCompleting
    }).lean();
    if (wrongCompleting && rightCompleting) {
        const wrongComps = await HrCompletion.find({ task: wrongCompleting._id }).lean();
        for (const c of wrongComps) {
            const exists = await HrCompletion.findOne({
                task: rightCompleting._id,
                month: c.month,
                year: c.year
            }).lean();
            if (exists) {
                await HrCompletion.deleteOne({ _id: c._id });
            } else {
                await HrCompletion.updateOne({ _id: c._id }, { $set: { task: rightCompleting._id } });
            }
        }
        await HrTask.deleteOne({ _id: wrongCompleting._id });
    } else if (wrongCompleting && !rightCompleting) {
        await HrTask.updateOne(
            { _id: wrongCompleting._id },
            { $set: { label: canonicalCompleting } }
        );
    }

    let tOrder = 0;
    for (const t of block.tasks) {
        await HrTask.findOneAndUpdate(
            { area: area._id, label: t.label },
            {
                $set: {
                    subLabel: t.subLabel || '',
                    sortOrder: tOrder++
                }
            },
            { upsert: true, returnDocument: 'after' }
        );
    }
}

module.exports = { seedHrEntities, ensureRecruitmentTasksFromSeed };
