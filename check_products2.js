const mongoose = require('mongoose');
require('dotenv').config();
const Product = require('./models/Product');

async function test() {
    await mongoose.connect(process.env.MONGO_URI);
    const products = await Product.find().sort({ createdAt: -1 }).limit(5);
    console.log("Last 5 products:");
    for (const p of products) {
        console.log(`- ${p.name} | planId: ${p.planId} | deptId: ${p.departmentId}`);
    }
    process.exit(0);
}
test();
