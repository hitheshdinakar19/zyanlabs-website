const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema(
    {
        title:   { type: String, required: true, trim: true },
        content: { type: String, required: true },
        excerpt: { type: String, required: true, trim: true }
    },
    { timestamps: true }   // adds createdAt + updatedAt automatically
);

module.exports = mongoose.model('Blog', blogSchema);
