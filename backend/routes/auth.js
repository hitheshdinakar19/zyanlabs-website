const express     = require('express');
const bcrypt      = require('bcryptjs');
const router      = express.Router();
const Admin       = require('../models/Admin');
const requireAuth = require('../middleware/auth');

/* ── POST /api/auth/login ─────────────────────────────────────────────────── */
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    try {
        const admin = await Admin.findOne({ email: email.toLowerCase().trim() });

        if (!admin) {
            return res.status(401).json({ success: false, error: 'Invalid credentials.' });
        }

        const match = await bcrypt.compare(password, admin.password);
        if (!match) {
            return res.status(401).json({ success: false, error: 'Invalid credentials.' });
        }

        // Regenerate session ID on login to prevent session fixation
        req.session.regenerate(err => {
            if (err) {
                console.error('[session regenerate error]', err.message);
                return res.status(500).json({ success: false, error: 'Server error.' });
            }
            req.session.isAdmin  = true;
            req.session.adminId  = admin._id.toString();
            res.json({ success: true });
        });

    } catch (err) {
        console.error('[login error]', err.message);
        res.status(500).json({ success: false, error: 'Server error.' });
    }
});

/* ── POST /api/auth/logout ────────────────────────────────────────────────── */
router.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) console.error('[logout error]', err.message);
        res.clearCookie('connect.sid');
        res.json({ success: true });
    });
});

/* ── GET /api/auth/session ────────────────────────────────────────────────── */
// Lightweight check — frontend calls this on page load to verify session
router.get('/session', (req, res) => {
    if (req.session && req.session.isAdmin) {
        return res.json({ success: true });
    }
    return res.status(401).json({ success: false });
});

/* ── POST /api/auth/change-password ──────────────────────────────────────── */
router.post('/change-password', requireAuth, async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
        return res.status(400).json({ success: false, error: 'Both passwords are required.' });
    }
    if (newPassword.length < 8) {
        return res.status(400).json({ success: false, error: 'New password must be at least 8 characters.' });
    }

    try {
        const admin = await Admin.findById(req.session.adminId);
        if (!admin) {
            return res.status(404).json({ success: false, error: 'Admin not found.' });
        }

        const match = await bcrypt.compare(oldPassword, admin.password);
        if (!match) {
            return res.status(401).json({ success: false, error: 'Current password is incorrect.' });
        }

        admin.password = await bcrypt.hash(newPassword, 12);
        await admin.save();

        res.json({ success: true, message: 'Password updated.' });

    } catch (err) {
        console.error('[change-password error]', err.message);
        res.status(500).json({ success: false, error: 'Server error.' });
    }
});

module.exports = router;
