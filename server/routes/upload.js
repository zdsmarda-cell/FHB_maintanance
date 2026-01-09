
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
// __dirname points to server/routes, so we go up twice to reach root
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '../../');

// Use IMG_PATH from env or default to 'uploads/images' relative to root
const uploadDir = path.resolve(rootDir, process.env.IMG_PATH || 'uploads/images');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
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
    // Return the URL path that matches the static serve route
    const fileUrl = `/uploads/images/${req.file.filename}`;
    res.json({ url: fileUrl });
});

export default router;
