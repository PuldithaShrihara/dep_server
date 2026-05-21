const mongoose = require('mongoose');
require('dotenv').config();

const Plan = require('./models/Plan');
const Product = require('./models/Product');

async function test() {
    await mongoose.connect(process.env.MONGO_URI);
    const lastProduct = await Product.findOne().sort({ createdAt: -1 });
    console.log("Last created product:", lastProduct);

    if (lastProduct && lastProduct.planId) {
        const plan = await Plan.findById(lastProduct.planId);
        console.log("Plan's products array:", plan ? plan.products : "plan not found");
        if (plan) {
            console.log("Is product in plan's array?", plan.products.includes(lastProduct._id));
        }
    } else if (lastProduct && lastProduct.createdInPlanId) {
        const plan = await Plan.findById(lastProduct.createdInPlanId);
        console.log("Plan's products array (fallback):", plan ? plan.products : "plan not found");
        if (plan) {
            console.log("Is product in plan's array?", plan.products.includes(lastProduct._id));
        }
    }
    
    process.exit(0);
}

test();
