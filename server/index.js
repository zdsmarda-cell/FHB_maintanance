
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

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// --- DEBUG LOGGER MIDDLEWARE ---
// This will log every request reaching the server to the console
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url} (IP: ${req.ip})`);
    next();
});

// Setup paths for ESM static serving
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '../');

// Serve uploaded files statically based on IMG_PATH
const imgPath = path.resolve(rootDir, process.env.IMG_PATH || 'uploads/images');

// Mount specific image path
app.use('/uploads/images', express.static(imgPath));

// Keep generic uploads mount for backward compatibility or other subfolders
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

const PORT = process.env.PORT || 3010;

// Initialize DB then start server
initDb().then(() => {
  console.log('--- Server Startup Diagnostics ---');
  console.log(`Current Root Dir: ${rootDir}`);
  console.log(`Env SSL_KEY_PATH: ${process.env.SSL_KEY_PATH || 'Not set'}`);
  console.log(`Env SSL_CERT_PATH: ${process.env.SSL_CERT_PATH || 'Not set'}`);

  // SSL Certificate Logic
  let sslKeyPath = process.env.SSL_KEY_PATH;
  let sslCertPath = process.env.SSL_CERT_PATH;

  // Resolve absolute paths
  if (sslKeyPath && !path.isAbsolute(sslKeyPath)) {
      sslKeyPath = path.resolve(rootDir, sslKeyPath);
  }
  if (sslCertPath && !path.isAbsolute(sslCertPath)) {
      sslCertPath = path.resolve(rootDir, sslCertPath);
  }

  // Check existence
  const keyExists = sslKeyPath && fs.existsSync(sslKeyPath);
  const certExists = sslCertPath && fs.existsSync(sslCertPath);

  console.log(`Resolved Key Path: ${sslKeyPath} (${keyExists ? 'FOUND' : 'MISSING'})`);
  console.log(`Resolved Cert Path: ${sslCertPath} (${certExists ? 'FOUND' : 'MISSING'})`);

  if (keyExists && certExists) {
    try {
      const httpsOptions = {
        key: fs.readFileSync(sslKeyPath),
        cert: fs.readFileSync(sslCertPath)
      };
      
      https.createServer(httpsOptions, app).listen(PORT, () => {
        console.log(`✅ SECURE HTTPS Server running on port ${PORT}`);
        console.log(`   URL: https://fhbmain.impossible.cz:${PORT}`);
      });
    } catch (e) {
      console.error('❌ CRITICAL: Failed to start HTTPS server despite finding files:', e.message);
      console.log('⚠️  Falling back to HTTP due to SSL error...');
      app.listen(PORT, () => {
        console.log(`⚠️  Server running on port ${PORT} (HTTP ONLY)`);
      });
    }
  } else {
    console.warn('⚠️  SSL Certificates not found or not configured.');
    app.listen(PORT, () => {
      console.log(`⚠️  Server running on port ${PORT} (HTTP ONLY)`);
      console.log(`   NOTE: Connect using http://, not https://`);
    });
  }
  console.log('----------------------------------');
});
