require('dotenv').config();

const express    = require('express');
const nodemailer = require('nodemailer');
const cors       = require('cors');
const http       = require('http');
const { Server } = require('socket.io');
const mongoose   = require('mongoose');
const Chat       = require('./models/Chat');
const blogRoutes = require('./routes/blogs');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});
const PORT = process.env.PORT || 5000;

/* ─────────────────────────────
   MONGODB CONNECTION
───────────────────────────── */

mongoose
    .connect(process.env.MONGO_URI || 'mongodb://localhost:27017/zyanlabs')
    .then(() => console.log('  MongoDB connected\n'))
    .catch(err => console.error('[mongo error]', err.message));

/* ─────────────────────────────
   MIDDLEWARE
───────────────────────────── */

app.use(cors());
app.use(express.json());

/* ─────────────────────────────
   NODEMAILER — ZOHO SMTP
───────────────────────────── */

const transporter = nodemailer.createTransport({
    host:   'smtp.zoho.com',
    port:   465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

/* ─────────────────────────────
   REAL-TIME CHAT — SOCKET.IO
───────────────────────────── */

const admins        = new Set();  // admin socket IDs
const socketToClient = new Map(); // socket.id → clientId

const WELCOME = "Hi 👋 Welcome to ZyanLabs! How can we help you today?";

io.on('connection', (socket) => {
    console.log(`[socket] connected   ${socket.id}`);

    // ── join ─────────────────────────────────────────────────────
    // Client sends its persistent clientId on every (re)connect.
    // We find or create the Chat document and return history.
    socket.on('join', async ({ clientId }) => {
        if (!clientId) return;

        socketToClient.set(socket.id, clientId);
        console.log(`[join]   ${socket.id}  clientId=${clientId}`);

        try {
            let chat = await Chat.findOne({ clientId });

            if (!chat) {
                // First visit: save welcome message, return it as history
                chat = await Chat.create({
                    clientId,
                    messages: [{ sender: 'admin', text: WELCOME }]
                });

                socket.emit('chat history', { messages: chat.messages });

            } else {
                // Returning user: send full history
                socket.emit('chat history', { messages: chat.messages });

                // Notify all admins so they can see the returning user's context
                admins.forEach(adminId => {
                    io.to(adminId).emit('user rejoined', {
                        clientId,
                        socketId: socket.id,
                        messages: chat.messages
                    });
                });
            }
        } catch (err) {
            console.error('[join error]', err.message);
        }
    });

    // ── register_admin ───────────────────────────────────────────
    socket.on('register_admin', () => {
        admins.add(socket.id);
        console.log(`[admin]  registered  ${socket.id}`);
    });

    // ── chat message (user → admins) ─────────────────────────────
    socket.on('chat message', async ({ msg }) => {
        if (!msg || !msg.trim()) return;

        const clientId = socketToClient.get(socket.id);
        console.log(`[user → admin]  ${socket.id}  "${msg}"`);

        // Persist to MongoDB
        if (clientId) {
            try {
                await Chat.updateOne(
                    { clientId },
                    { $push: { messages: { sender: 'user', text: msg.trim() } } }
                );
            } catch (err) {
                console.error('[save user msg]', err.message);
            }
        }

        // Forward to all admins
        admins.forEach(adminId => {
            io.to(adminId).emit('user message', {
                msg:      msg.trim(),
                socketId: socket.id,
                clientId: clientId || socket.id
            });
        });
    });

    // ── admin reply (admin → specific user) ──────────────────────
    socket.on('admin reply', async ({ msg, socketId }) => {
        if (!msg || !socketId) return;

        const clientId = socketToClient.get(socketId);
        console.log(`[admin → user]   ${socketId}  "${msg}"`);

        // Persist to MongoDB
        if (clientId) {
            try {
                await Chat.updateOne(
                    { clientId },
                    { $push: { messages: { sender: 'admin', text: msg } } }
                );
            } catch (err) {
                console.error('[save admin reply]', err.message);
            }
        }

        // Deliver to user
        io.to(socketId).emit('chat message', { sender: 'admin', msg });
    });

    // ── disconnect ───────────────────────────────────────────────
    socket.on('disconnect', () => {
        admins.delete(socket.id);
        socketToClient.delete(socket.id);
        console.log(`[socket] disconnected ${socket.id}`);
    });
});

/* ─────────────────────────────
   REST ROUTES
───────────────────────────── */

app.get('/', (_req, res) => {
    res.json({ status: 'ZyanLabs backend is running.' });
});

// ── Blog routes ───────────────────────────────────────────────────────────
app.use('/api/blogs', blogRoutes);

// ── POST /api/contact ─────────────────────────────────────────────────────
app.post('/api/contact', async (req, res) => {
    const { name, email, service, budget, message } = req.body;

    if (!name || !email) {
        return res.status(400).json({ success: false, error: 'Name and email are required.' });
    }

    const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;
                background:#0f172a;color:#ffffff;padding:36px;border-radius:14px;">

      <h2 style="margin:0 0 8px;color:#7c5cff;font-size:22px;">
        New Enquiry — ZyanLabs
      </h2>
      <p style="margin:0 0 28px;color:rgba(255,255,255,0.45);font-size:13px;">
        Submitted via the ZyanLabs contact form
      </p>

      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:10px 0;color:rgba(255,255,255,0.5);font-size:13px;width:130px;">Name</td>
          <td style="padding:10px 0;font-weight:600;">${escapeHtml(name)}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:rgba(255,255,255,0.5);font-size:13px;">Email</td>
          <td style="padding:10px 0;">
            <a href="mailto:${escapeHtml(email)}"
               style="color:#5aa9ff;text-decoration:none;">${escapeHtml(email)}</a>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:rgba(255,255,255,0.5);font-size:13px;">Service</td>
          <td style="padding:10px 0;">${escapeHtml(service || '—')}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:rgba(255,255,255,0.5);font-size:13px;">Budget</td>
          <td style="padding:10px 0;">${escapeHtml(budget || '—')}</td>
        </tr>
      </table>

      <div style="margin-top:24px;padding:18px;background:rgba(255,255,255,0.05);
                  border-radius:10px;border-left:3px solid #7c5cff;">
        <p style="margin:0 0 8px;color:rgba(255,255,255,0.45);
                  font-size:12px;letter-spacing:1px;text-transform:uppercase;">Message</p>
        <p style="margin:0;line-height:1.75;white-space:pre-wrap;">${escapeHtml(message || 'No message provided.')}</p>
      </div>

    </div>`;

    try {
        await transporter.sendMail({
            from:    `"ZyanLabs Website" <${process.env.EMAIL_USER}>`,
            to:      process.env.EMAIL_USER,
            replyTo: email,
            subject: `New Enquiry from ${name} — ZyanLabs`,
            html,
        });
        res.json({ success: true });
    } catch (err) {
        console.error('[mail error]', err.message);
        res.status(500).json({ success: false, error: 'Failed to send email.' });
    }
});

/* ─────────────────────────────
   HELPERS
───────────────────────────── */

function escapeHtml(str) {
    return String(str)
        .replace(/&/g,  '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')
        .replace(/"/g,  '&quot;')
        .replace(/'/g,  '&#039;');
}

/* ─────────────────────────────
   START
───────────────────────────── */

server.listen(PORT, () => {
    console.log(`\n  ZyanLabs backend running → http://localhost:${PORT}`);
});
