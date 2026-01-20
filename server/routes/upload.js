
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');
const uploadDir = path.resolve(rootDir, process.env.IMG_PATH || 'uploads/images');

// Ensure directory exists
if (!fs.existsSync(uploadDir)) {
    try {
        fs.mkdirSync(uploadDir, { recursive: true });
    } catch (err) {
        console.error(`❌ Failed to create upload directory: ${uploadDir}`, err);
    }
}

// Use Memory Storage to process image before saving
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.post('/', upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const timestamp = Date.now();
        const uniqueSuffix = Math.round(Math.random() * 1E9);
        const baseFilename = `img-${timestamp}-${uniqueSuffix}`;
        
        // Define paths
        const desktopFilename = `${baseFilename}_desktop.webp`;
        const mobileFilename = `${baseFilename}_mobile.webp`;
        
        const desktopPath = path.join(uploadDir, desktopFilename);
        const mobilePath = path.join(uploadDir, mobileFilename);

        // 1. Generate Desktop Version (Max width 1920px, Quality 80)
        await sharp(req.file.buffer)
            .resize({ width: 1920, withoutEnlargement: true })
            .webp({ quality: 80 })
            .toFile(desktopPath);

        // 2. Generate Mobile Version (Max width 800px, Quality 65)
        await sharp(req.file.buffer)
            .resize({ width: 800, withoutEnlargement: true })
            .webp({ quality: 65 })
            .toFile(mobilePath);

        console.log(`[UPLOAD] Processed & Saved: ${desktopFilename} & ${mobileFilename}`);

        // Return the desktop URL as the main URL for the DB
        // The mobile URL can be derived by the frontend if needed by replacing '_desktop.webp' with '_mobile.webp'
        const fileUrl = `/uploads/images/${desktopFilename}`;
        
        res.json({ 
            url: fileUrl,
            mobileUrl: `/uploads/images/${mobileFilename}`
        });

    } catch (error) {
        console.error("Image processing failed:", error);
        res.status(500).json({ error: 'Image processing failed' });
    }
});

export default router;
