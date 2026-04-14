const express = require('express');
const router  = express.Router();
const Blog    = require('../models/Blog');

// ── GET /api/blogs ─────────────────────────────────────────────────────────
// Returns all posts, newest first. Excludes full content from list view.
router.get('/', async (_req, res) => {
    try {
        const blogs = await Blog
            .find({}, 'title excerpt createdAt')
            .sort({ createdAt: -1 });

        res.json({ success: true, blogs });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── GET /api/blogs/:id ─────────────────────────────────────────────────────
// Returns a single post with full content.
router.get('/:id', async (req, res) => {
    try {
        const blog = await Blog.findById(req.params.id);
        if (!blog) {
            return res.status(404).json({ success: false, error: 'Post not found.' });
        }
        res.json({ success: true, blog });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── POST /api/blogs ────────────────────────────────────────────────────────
// Create a new post. Use Postman / curl for now (no auth yet).
// Body: { title, content, excerpt }
router.post('/', async (req, res) => {
    try {
        const { title, content, excerpt } = req.body;

        if (!title || !content || !excerpt) {
            return res.status(400).json({
                success: false,
                error: 'title, content, and excerpt are all required.'
            });
        }

        const blog = await Blog.create({ title, content, excerpt });
        res.status(201).json({ success: true, blog });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
