
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../');
const uploadDir = path.resolve(rootDir, process.env.IMG_PATH || 'uploads/images');

export const runImageOptimizer = async () => {
    console.log('--- Image Optimizer: Checking for missing WebP variants ---');

    if (!fs.existsSync(uploadDir)) {
        console.log('Upload directory does not exist, skipping optimization.');
        return;
    }

    try {
        const files = fs.readdirSync(uploadDir);
        let processedCount = 0;

        for (const file of files) {
            // Check if it is a source image (jpg, png, jpeg) AND not already a generated webp variant
            // We skip existing _desktop.webp or _mobile.webp files to avoid double processing
            if (file.match(/\.(jpg|jpeg|png)$/i) && !file.includes('_desktop') && !file.includes('_mobile')) {
                
                const nameWithoutExt = path.parse(file).name;
                const desktopWebp = `${nameWithoutExt}_desktop.webp`;
                const mobileWebp = `${nameWithoutExt}_mobile.webp`;

                const desktopPath = path.join(uploadDir, desktopWebp);
                const mobilePath = path.join(uploadDir, mobileWebp);
                const sourcePath = path.join(uploadDir, file);

                // Check if variants exist
                const desktopExists = fs.existsSync(desktopPath);
                const mobileExists = fs.existsSync(mobilePath);

                if (!desktopExists || !mobileExists) {
                    console.log(`[Optimizer] Generating WebP for: ${file}`);
                    
                    try {
                        const imageBuffer = fs.readFileSync(sourcePath);

                        if (!desktopExists) {
                            await sharp(imageBuffer)
                                .resize({ width: 1920, withoutEnlargement: true })
                                .webp({ quality: 80 })
                                .toFile(desktopPath);
                        }

                        if (!mobileExists) {
                            await sharp(imageBuffer)
                                .resize({ width: 800, withoutEnlargement: true })
                                .webp({ quality: 65 })
                                .toFile(mobilePath);
                        }
                        processedCount++;
                    } catch (err) {
                        console.error(`[Optimizer] Failed to convert ${file}:`, err.message);
                    }
                }
            }
        }

        if (processedCount > 0) {
            console.log(`--- Image Optimizer: Generated variants for ${processedCount} images ---`);
        } else {
            console.log('--- Image Optimizer: All images are up to date ---');
        }

    } catch (err) {
        console.error('--- Image Optimizer Error ---', err);
    }
};
