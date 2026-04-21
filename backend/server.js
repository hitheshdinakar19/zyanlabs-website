require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const express    = require('express');
const nodemailer = require('nodemailer');
const cors       = require('cors');
const session    = require('express-session');
const bcrypt     = require('bcryptjs');
const http       = require('http');
const path       = require('path');
const { Server } = require('socket.io');
const mongoose   = require('mongoose');
const Chat       = require('./models/Chat');
const Admin      = require('./models/Admin');
const blogRoutes = require('./routes/blogs');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});
const PORT = process.env.PORT || 3000;

/* ─────────────────────────────
   ADMIN CREDENTIALS
   Password is hashed once at startup — never stored in plain text.
   Change via ADMIN_EMAIL / ADMIN_PASSWORD env vars before deploying.
───────────────────────────── */

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL    || 'admin@zyanlabs.com').toLowerCase().trim();
const ADMIN_HASH  =  bcrypt.hashSync(
    process.env.ADMIN_PASSWORD || 'Zyan@123',
    12
);

/* ─────────────────────────────
   MONGODB CONNECTION
───────────────────────────── */

if (!process.env.MONGO_URI) {
    console.error("MONGO_URI missing");
    process.exit(1);
}

console.log("Using Mongo URI:", process.env.MONGO_URI);

mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
        console.log('  MongoDB connected');
        console.log('  DB name:', mongoose.connection.name);
        console.log('  DB host:', mongoose.connection.host);

        server.listen(PORT, () => {
            console.log(`\n  ZyanLabs server running → http://localhost:${PORT}`);
            console.log(`  Admin login          → http://localhost:${PORT}/login.html\n`);
        });
    })
    .catch(err => {
        console.error('[mongo error]', err.message);
        process.exit(1);
    });

/* ─────────────────────────────
   MIDDLEWARE
───────────────────────────── */

app.set('trust proxy', 1);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(session({
    secret:            process.env.SESSION_SECRET || 'zyanlabs_secret_key',
    resave:            false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge:   24 * 60 * 60 * 1000 // 24 hours
    }
}));

/* ─────────────────────────────
   AUTH — SESSION HELPER
───────────────────────────── */

function requireSession(req, res, next) {
    if (req.session && req.session.adminId) return next();
    res.redirect('/login.html');
}

/* ─────────────────────────────
   PROTECTED STATIC ROUTE
   Registered BEFORE express.static so the session guard
   intercepts /admin.html before the file can be served raw.
───────────────────────────── */

app.get('/admin.html', requireSession, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'admin.html'));
});

/* ─────────────────────────────
   STATIC FILES (whole website)
───────────────────────────── */

app.use(express.static(path.join(__dirname, '..')));

/* ─────────────────────────────
   AUTH API
───────────────────────────── */

// POST /api/login
app.post('/api/login', async (req, res) => {
    const { email = '', password = '' } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    console.log("Searching for:", email);
    const user = await Admin.findOne({ email: email.toLowerCase().trim() });
    console.log("User found:", user);

    if (!user) {
        return res.status(401).json({ success: false, error: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    console.log("Password match:", isMatch);

    if (!isMatch) {
        return res.status(401).json({ success: false, error: 'Invalid credentials.' });
    }

    // Regenerate session ID on login to prevent session fixation attacks
    req.session.regenerate(err => {
        if (err) {
            console.error('[session error]', err.message);
            return res.status(500).json({ success: false, error: 'Server error.' });
        }
        req.session.adminId = user.email;
        res.json({ success: true });
    });
});

// GET /api/check-auth
app.get('/api/check-auth', (req, res) => {
    if (req.session && req.session.adminId) {
        return res.json({ loggedIn: true });
    }
    res.status(401).json({ loggedIn: false });
});

// POST /api/logout
app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) console.error('[logout error]', err.message);
        res.clearCookie('connect.sid');
        res.json({ success: true });
    });
});

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

const admins         = new Set();  // admin socket IDs
const socketToClient = new Map();  // socket.id → clientId
const clientToInfo   = new Map();  // clientId → { email, name }

const WELCOME = "Hi 👋 Welcome to ZyanLabs! How can we help you today?";

io.on('connection', (socket) => {
    console.log(`[socket] connected   ${socket.id}`);

    socket.on('join', async ({ clientId, email, name }) => {
        if (!clientId) return;
        socketToClient.set(socket.id, clientId);
        console.log(`[join]   ${socket.id}  clientId=${clientId}  email=${email || '—'}`);
        try {
            let chat = await Chat.findOne({ clientId });
            if (!chat) {
                chat = new Chat({
                    clientId,
                    email: email || '',
                    name:  name  || '',
                    messages: [{ sender: 'admin', text: WELCOME }]
                });
                await chat.save();
                clientToInfo.set(clientId, { email: chat.email, name: chat.name });
                socket.emit('chat history', { messages: chat.messages });
            } else {
                // Update email / name if not already stored
                if (!chat.email && email) chat.email = email;
                if (!chat.name  && name)  chat.name  = name;
                await chat.save();
                clientToInfo.set(clientId, { email: chat.email, name: chat.name });
                socket.emit('chat history', { messages: chat.messages });
                admins.forEach(adminId => {
                    io.to(adminId).emit('user rejoined', {
                        clientId, socketId: socket.id, messages: chat.messages,
                        email: chat.email || '', name: chat.name || ''
                    });
                });
            }
        } catch (err) {
            console.error('[join error]', err.message);
        }
    });

    socket.on('register_admin', () => {
        admins.add(socket.id);
        console.log(`[admin]  registered  ${socket.id}`);
    });

    socket.on('chat message', async (data) => {
        if (!data.msg || !data.msg.trim()) return;
        const clientId = data.clientId || socketToClient.get(socket.id) || socket.id;
        console.log("Incoming chat data:", { msg: data.msg, clientId, socketId: socket.id });
        try {
            const result = await Chat.updateOne(
                { clientId },
                { $push: { messages: { text: data.msg, sender: 'user', timestamp: new Date() } } },
                { upsert: true }
            );
            console.log("Chat saved for:", clientId);
            console.log("updateOne result:", JSON.stringify(result));
            console.log("Writing to DB:", mongoose.connection.name);
        } catch (err) { console.error("Chat save error:", err); }
        const info = clientToInfo.get(clientId) || {};
        admins.forEach(adminId => {
            io.to(adminId).emit('user message', {
                msg: data.msg.trim(), socketId: socket.id, clientId,
                email: info.email || '', name: info.name || ''
            });
        });
    });

    socket.on('admin reply', async (data) => {
        if (!data.msg || !data.socketId) return;
        const { socketId } = data;
        const clientId = data.clientId || socketToClient.get(socketId) || socketId;
        try {
            await Chat.updateOne(
                { clientId },
                { $push: { messages: { text: data.msg, sender: 'admin', timestamp: new Date() } } },
                { upsert: true }
            );
        } catch (err) { console.error("Chat save error:", err); }
        io.to(socketId).emit('chat message', { sender: 'admin', msg: data.msg });
    });

    socket.on('disconnect', () => {
        admins.delete(socket.id);
        socketToClient.delete(socket.id);
        console.log(`[socket] disconnected ${socket.id}`);
    });
});

/* ─────────────────────────────
   DASHBOARD API
───────────────────────────── */

// GET /api/chat/:clientId — full chat document for a given clientId
app.get('/api/chat/:clientId', requireSession, async (req, res) => {
    try {
        const chat = await Chat.findOne({ clientId: req.params.clientId });
        if (!chat) return res.status(404).json({ error: 'Chat not found' });
        res.json(chat);
    } catch (err) {
        console.error('[api/chat error]', err.message);
        res.status(500).json({ error: 'Failed to fetch chat.' });
    }
});

// GET /api/users — list of all unique users with their first-seen date
app.get('/api/users', requireSession, async (req, res) => {
    try {
        const users = await Chat.find({}, 'clientId email name createdAt').sort({ createdAt: -1 }).lean();
        res.json(users.map(u => ({
            clientId: u.clientId,
            email:    u.email || '',
            name:     u.name  || '',
            joinedAt: u.createdAt
        })));
    } catch (err) {
        console.error('[api/users error]', err.message);
        res.status(500).json({ error: 'Failed to load users.' });
    }
});

// GET /api/chats — all chat sessions with message count and last activity
app.get('/api/chats', requireSession, async (req, res) => {
    try {
        const chats = await Chat.find({}, 'clientId email name messages updatedAt').sort({ updatedAt: -1 }).lean();
        res.json(chats.map(c => ({
            clientId:     c.clientId,
            email:        c.email || '',
            name:         c.name  || '',
            messageCount: c.messages.length,
            lastActivity: c.updatedAt
        })));
    } catch (err) {
        console.error('[api/chats error]', err.message);
        res.status(500).json({ error: 'Failed to load chats.' });
    }
});

// GET /api/messages-today — all messages sent today across all chats
app.get('/api/messages-today', requireSession, async (req, res) => {
    try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const results = await Chat.aggregate([
            { $unwind: '$messages' },
            { $match: { 'messages.timestamp': { $gte: startOfDay } } },
            { $project: {
                _id:       0,
                clientId:  1,
                email:     1,
                name:      1,
                sender:    '$messages.sender',
                text:      '$messages.text',
                timestamp: '$messages.timestamp'
            }}
        ]);
        res.json(results);
    } catch (err) {
        console.error('[api/messages-today error]', err.message);
        res.status(500).json({ error: 'Failed to load today\'s messages.' });
    }
});

app.get('/api/dashboard', requireSession, async (req, res) => {
    try {
        const totalUsers = await Chat.countDocuments();

        const msgAgg = await Chat.aggregate([
            { $project: { count: { $size: '$messages' } } },
            { $group: { _id: null, total: { $sum: '$count' } } }
        ]);
        const totalChats = msgAgg[0]?.total ?? 0;

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const todayAgg = await Chat.aggregate([
            { $unwind: '$messages' },
            { $match: { 'messages.timestamp': { $gte: startOfDay } } },
            { $count: 'count' }
        ]);
        const messagesToday = todayAgg[0]?.count ?? 0;

        res.json({ totalUsers, totalChats, messagesToday });
    } catch (err) {
        console.error('[dashboard error]', err.message);
        res.status(500).json({ error: 'Failed to load dashboard data.' });
    }
});

/* ─────────────────────────────
   BLOG ROUTES
───────────────────────────── */

app.use('/api/blogs', blogRoutes);

/* ─────────────────────────────
   CONTACT FORM
───────────────────────────── */

app.post('/api/contact', async (req, res) => {
    const { name, email, service, budget, message } = req.body;

    if (!name || !email) {
        return res.status(400).json({ success: false, error: 'Name and email are required.' });
    }

    const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;
                background:#0f172a;color:#ffffff;padding:36px;border-radius:14px;">
      <h2 style="margin:0 0 8px;color:#7c5cff;font-size:22px;">New Enquiry — ZyanLabs</h2>
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
            <a href="mailto:${escapeHtml(email)}" style="color:#5aa9ff;text-decoration:none;">
              ${escapeHtml(email)}
            </a>
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
        <p style="margin:0;line-height:1.75;white-space:pre-wrap;">
          ${escapeHtml(message || 'No message provided.')}
        </p>
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

