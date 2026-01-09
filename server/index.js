
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

// Setup paths for ESM static serving
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '../');

// Serve uploaded files statically based on IMG_PATH
const imgPath = path.resolve(rootDir, process.env.IMG_PATH || 'uploads/images');

// Ensure the directory exists (safe check)
if (!fs.existsSync(imgPath)) {
    fs.mkdirSync(imgPath, { recursive: true });
}

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
  const sslKeyPath = process.env.SSL_KEY_PATH;
  const sslCertPath = process.env.SSL_CERT_PATH;

  // Check if SSL certs are provided and exist
  if (sslKeyPath && sslCertPath && fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
    try {
      const httpsOptions = {
        key: fs.readFileSync(sslKeyPath),
        cert: fs.readFileSync(sslCertPath)
      };
      
      https.createServer(httpsOptions, app).listen(PORT, () => {
        console.log(`Secure Server running on port ${PORT} (HTTPS)`);
        console.log(`URL: ${process.env.APP_URL || `https://localhost:${PORT}`}`);
        console.log(`Images stored in: ${imgPath}`);
      });
    } catch (e) {
      console.error('Failed to start HTTPS server:', e);
    }
  } else {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} (HTTP)`);
      console.log(`URL: ${process.env.APP_URL || `http://localhost:${PORT}`}`);
      console.log(`Images stored in: ${imgPath}`);
    });
  }
});
