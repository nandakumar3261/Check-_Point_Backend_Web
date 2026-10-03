/**
 * Aditya Security Guard - Backend API server
 *
 * Standalone Express + MongoDB backend. It no longer serves the web
 * dashboard - the web front end runs as its own project on its own port.
 * Connects to MongoDB for authentication, user (admin/guard) management,
 * duty places (main places + sub-places), duty assignments, QR scans, and
 * uploaded site-visit images / profile photos.
 *
 * Uploaded files (routes/uploadedImages.js, routes/users.js) are stored on
 * local disk under ./public/uploads and served from /uploads/... - that is
 * the only thing express.static serves here.
 *
 * Ports are intentionally separate:
 *   - Backend API: PORT in .env (default 3000)
 *   - Web:         its own project / its own port
 *   - MongoDB:     part of MONGO_URI in .env (default 27017, MongoDB's
 *                  standard port) - it is a completely separate process.
 *
 * First-time setup:
 *   1. Make sure MongoDB is reachable (local server, or Atlas via MONGO_URI)
 *   2. cp .env.example .env   (adjust PORT / MONGO_* if needed)
 *   3. npm install
 *   4. Create the first admin user directly in mongosh - use `npm run hash`
 *      to get a bcrypt hash for your chosen password first.
 *   5. npm start
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const dutyPlaceRoutes = require('./routes/dutyPlaces');
const dutyAssignmentRoutes = require('./routes/dutyAssignments');
const qrScanRoutes = require('./routes/qrScans');
const uploadedImageRoutes = require('./routes/uploadedImages');
const scanSettingRoutes = require('./routes/scanSettings');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
// Serves only ./public/uploads (uploaded images + profile photos) at /uploads/...
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/duty-places', dutyPlaceRoutes);
app.use('/api/duty-assignments', dutyAssignmentRoutes);
app.use('/api/qr-scans', qrScanRoutes);
app.use('/api/uploaded-images', uploadedImageRoutes);
app.use('/api/scan-settings', scanSettingRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', database: 'MongoDB (see /api/health/db for connection state)' });
});

// Any /api/* path that didn't match a route above gets a JSON 404 instead
// of Express's default HTML error page. Without this, a typo'd endpoint or
// an old server process missing a newly-added route returns HTML, and the
// frontend's res.json() call fails with a confusing
// "Unexpected token '<', <!DOCTYPE..." error instead of a clear message.
app.use('/api', (req, res) => {
  res.status(404).json({ error: `No API route: ${req.method} ${req.originalUrl}` });
});

// Final safety net: turn any uncaught error into JSON instead of Express's
// default HTML error page, so the frontend always gets parseable JSON back.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Unexpected server error.' });
});

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Aditya Security Guard backend API running at http://localhost:${PORT}`);
  });
});
