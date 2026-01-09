
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
// __dirname points to server/routes, so we go up twice to reach root
const __dirname = path.dirname(__filename);

// Use path.resolve to get an absolute path to avoid relative path confusion
const rootDir = path.resolve(__dirname, '../../');
const uploadDir = path.resolve(rootDir, process.env.IMG_PATH || 'uploads/images');

// --- DEBUG LOGGING ---
console.log('--- UPLOAD ROUTE INIT ---');
console.log('Current File:', __filename);
console.log('Current Dir:', __dirname);
console.log('Calculated Root Dir:', rootDir);
console.log('Target Upload Dir (Absolute):', uploadDir);

// Ensure directory exists synchronously before configuring multer
if (!fs.existsSync(uploadDir)) {
    try {
        console.log('Upload directory does not exist. Attempting to create:', uploadDir);
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log(`✅ Created upload directory: ${uploadDir}`);
    } catch (err) {
        console.error(`❌ Failed to create upload directory: ${uploadDir}`, err);
    }
} else {
    console.log('✅ Upload directory exists.');
    // Check permissions
    try {
        fs.accessSync(uploadDir, fs.constants.W_OK);
        console.log('✅ Upload directory is writable.');
    } catch (err) {
        console.error('❌ Upload directory is NOT writable!', err);
    }
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

router.post('/', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    console.log(`[UPLOAD] File saved to: ${req.file.path}`);
    
    // Return the URL path that matches the static serve route
    const fileUrl = `/uploads/images/${req.file.filename}`;
    res.json({ url: fileUrl });
});

export default router;
