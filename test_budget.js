const mongoose = require('mongoose');
require('dotenv').config({path: './.env'});
mongoose.connect(process.env.MONGO_URI).then(async () => {
    const Plan = require('./models/Plan');
    const p = await Plan.findOne();
    if(p && p.tasks && p.tasks.length > 0) {
        console.log(JSON.stringify(p.tasks[0], null, 2));
    } else {
        console.log('no tasks');
    }
    process.exit(0);
});
