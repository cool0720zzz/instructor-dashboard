const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./db/database');

// Import routes
const authRoutes = require('./routes/auth');
const licenseRoutes = require('./routes/license');
const customerRoutes = require('./routes/customers');
const instructorRoutes = require('./routes/instructors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Public API routes (no auth)
app.use('/api', licenseRoutes);

// Admin routes (auth required - middleware applied inside each router)
app.use('/admin/auth', authRoutes);
app.use('/admin/customers', customerRoutes);
app.use('/admin', instructorRoutes);

// Serve static client files in production
const clientPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientPath));

// SPA fallback
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/admin')) {
    res.sendFile(path.join(clientPath, 'index.html'));
  } else {
    res.status(404).json({ error: 'Route not found' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize database then start server
async function start() {
  await initDatabase();
  console.log('Database initialized');

  app.listen(PORT, () => {
    console.log(`Admin server running on http://localhost:${PORT}`);
    console.log(`API endpoint: http://localhost:${PORT}/api/validate-license`);
    console.log(`Admin panel: http://localhost:${PORT}/admin/`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

module.exports = app;
