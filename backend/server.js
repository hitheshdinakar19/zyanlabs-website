require('dotenv').config();

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

mongoose
    .connect(process.env.MONGO_URI || 'mongodb://localhost:27017/zyanlabs')
    .then(() => {
        console.log('  MongoDB connected');
        console.log('  DB name:', mongoose.connection.name);
        console.log('  DB host:', mongoose.connection.host);
    })
    .catch(err => console.error('[mongo error]', err.message));

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

const WELCOME = "Hi 👋 Welcome to ZyanLabs! How can we help you today?";

io.on('connection', (socket) => {
    console.log(`[socket] connected   ${socket.id}`);

    socket.on('join', async ({ clientId }) => {
        if (!clientId) return;
        socketToClient.set(socket.id, clientId);
        console.log(`[join]   ${socket.id}  clientId=${clientId}`);
        try {
            let chat = await Chat.findOne({ clientId });
            if (!chat) {
                chat = await Chat.create({
                    clientId,
                    messages: [{ sender: 'admin', text: WELCOME }]
                });
                socket.emit('chat history', { messages: chat.messages });
            } else {
                socket.emit('chat history', { messages: chat.messages });
                admins.forEach(adminId => {
                    io.to(adminId).emit('user rejoined', {
                        clientId, socketId: socket.id, messages: chat.messages
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
        admins.forEach(adminId => {
            io.to(adminId).emit('user message', {
                msg: data.msg.trim(), socketId: socket.id, clientId
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

/* ─────────────────────────────
   START
───────────────────────────── */

server.listen(PORT, () => {
    console.log(`\n  ZyanLabs server running → http://localhost:${PORT}`);
    console.log(`  Admin login          → http://localhost:${PORT}/login.html\n`);
});
