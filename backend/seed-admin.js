/**
 * seed-admin.js
 * Run ONCE to create the initial admin user:
 *
 *   node seed-admin.js
 *
 * Edit EMAIL and PASSWORD below before running.
 * After running, delete or ignore this file — never commit it with credentials.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const Admin    = require('./models/Admin');

/* ── Configure these before running ─────────────────────────────────── */
const EMAIL    = 'admin@zyanlabs.com';   // change to your email
const PASSWORD = 'YourStrongPassword1!'; // change to your desired password
/* ─────────────────────────────────────────────────────────────────── */

(async () => {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/zyanlabs');
    console.log('MongoDB connected');

    const existing = await Admin.findOne({ email: EMAIL });
    if (existing) {
        console.log('Admin already exists. Use change-password to update.');
        await mongoose.disconnect();
        return;
    }

    const hash = await bcrypt.hash(PASSWORD, 12);
    await Admin.create({ email: EMAIL, password: hash });

    console.log(`\n  Admin created: ${EMAIL}`);
    console.log('  Run the server and log in at /login.html\n');
    await mongoose.disconnect();
})();
