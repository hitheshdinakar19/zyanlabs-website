/**
 * requireAuth — session-based middleware for protected API routes.
 * Attach to any route that requires an active admin session.
 */
module.exports = function requireAuth(req, res, next) {
    if (req.session && req.session.isAdmin) {
        return next();
    }
    return res.status(401).json({ success: false, error: 'Not authenticated.' });
};
