
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import https from 'https';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Middleware
import { authenticateToken } from './middleware/auth.js';
import { initDb } from './initDb.js';

// Routes
import authRoutes from './routes/auth.js';
import uploadRoutes from './routes/upload.js';
import userRoutes from './routes/users.js';
import techRoutes from './routes/technologies.js';
import requestRoutes from './routes/requests.js';
import settingsRoutes from './routes/settings.js';
import emailRoutes from './routes/emails.js';
import locationRoutes from './routes/locations.js'; 
import supplierRoutes from './routes/suppliers.js'; 
import configRoutes from './routes/config.js'; 
import maintenanceRoutes from './routes/maintenance.js'; 
import translateRoutes from './routes/translate.js'; // NEW

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// --- DEBUG LOGGER MIDDLEWARE ---
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url} (IP: ${req.ip})`);
    next();
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '../');
const imgPath = path.resolve(rootDir, process.env.IMG_PATH || 'uploads/images');

app.use('/uploads/images', express.static(imgPath));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// --- Public Routes ---
app.use('/api/auth', authRoutes);

// --- Protected Routes (Require JWT) ---
app.use('/api/upload', authenticateToken, uploadRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/technologies', authenticateToken, techRoutes);
app.use('/api/requests', authenticateToken, requestRoutes);
app.use('/api/settings', authenticateToken, settingsRoutes);
app.use('/api/emails', authenticateToken, emailRoutes);
app.use('/api/locations', authenticateToken, locationRoutes);
app.use('/api/suppliers', authenticateToken, supplierRoutes);
app.use('/api/config', authenticateToken, configRoutes);
app.use('/api/maintenance', authenticateToken, maintenanceRoutes);
app.use('/api/translate', authenticateToken, translateRoutes); // NEW

const PORT = process.env.PORT || 3010;

initDb().then(() => {
  console.log('--- Server Startup Diagnostics ---');
  let sslKeyPath = process.env.SSL_KEY_PATH;
  let sslCertPath = process.env.SSL_CERT_PATH;
  if (sslKeyPath && !path.isAbsolute(sslKeyPath)) sslKeyPath = path.resolve(rootDir, sslKeyPath);
  if (sslCertPath && !path.isAbsolute(sslCertPath)) sslCertPath = path.resolve(rootDir, sslCertPath);
  const keyExists = sslKeyPath && fs.existsSync(sslKeyPath);
  const certExists = sslCertPath && fs.existsSync(sslCertPath);

  if (keyExists && certExists) {
    try {
      https.createServer({ key: fs.readFileSync(sslKeyPath), cert: fs.readFileSync(sslCertPath) }, app).listen(PORT, () => {
        console.log(`✅ SECURE HTTPS Server running on port ${PORT}`);
      });
    } catch (e) {
      console.error('❌ SSL Error, falling back to HTTP:', e.message);
      app.listen(PORT, () => console.log(`⚠️ Server running on port ${PORT} (HTTP)`));
    }
  } else {
    app.listen(PORT, () => console.log(`⚠️ Server running on port ${PORT} (HTTP)`));
  }
});
