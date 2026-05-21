const mongoose = require('mongoose');
require('dotenv').config();

const Plan = require('./models/Plan');

async function test() {
    await mongoose.connect(process.env.MONGO_URI);
    const plan = await Plan.findOne().sort({ createdAt: -1 });
    console.log("Last created plan:", plan);
    process.exit(0);
}

test();
