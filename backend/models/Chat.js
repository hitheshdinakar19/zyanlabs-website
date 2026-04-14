const mongoose = require('mongoose');

/* ── Message sub-document ───────────────────────────────── */
const messageSchema = new mongoose.Schema(
    {
        sender:    { type: String, enum: ['user', 'admin'], required: true },
        text:      { type: String, required: true },
        timestamp: { type: Date,   default: Date.now }
    },
    { _id: false }   // no separate _id per message — keeps documents lean
);

/* ── Chat document (one per user session) ───────────────── */
const chatSchema = new mongoose.Schema(
    {
        clientId: { type: String, required: true, unique: true, index: true },
        messages: [messageSchema]
    },
    { timestamps: true }   // adds createdAt / updatedAt
);

module.exports = mongoose.model('Chat', chatSchema);
