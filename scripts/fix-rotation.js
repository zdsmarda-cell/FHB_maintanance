
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Načtení .env pro získání cesty k obrázkům
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const rootDir = path.resolve(__dirname, '../');
const uploadDir = path.resolve(rootDir, process.env.IMG_PATH || 'uploads/images');

const run = async () => {
    console.log('🚀 Startuji opravu rotace obrázků...');
    console.log(`📂 Složka: ${uploadDir}`);

    if (!fs.existsSync(uploadDir)) {
        console.error('❌ Složka s obrázky neexistuje.');
        process.exit(1);
    }

    try {
        const files = fs.readdirSync(uploadDir);
        let processedCount = 0;

        for (const file of files) {
            // Hledáme pouze zdrojové soubory (JPG/PNG), nikoliv vygenerované WebP varianty
            if (file.match(/\.(jpg|jpeg|png)$/i) && !file.includes('_desktop') && !file.includes('_mobile')) {
                
                const nameWithoutExt = path.parse(file).name;
                const sourcePath = path.join(uploadDir, file);
                
                // Cesty k variantám
                const desktopPath = path.join(uploadDir, `${nameWithoutExt}_desktop.webp`);
                const mobilePath = path.join(uploadDir, `${nameWithoutExt}_mobile.webp`);

                console.log(`🔄 Přepracovávám: ${file}`);

                try {
                    const imageBuffer = fs.readFileSync(sourcePath);

                    // 1. Desktop (s rotací a metadaty)
                    await sharp(imageBuffer)
                        .rotate() // Automatická rotace podle EXIF
                        .resize({ width: 1920, withoutEnlargement: true })
                        .withMetadata() // Zachová/Opraví EXIF orientaci
                        .webp({ quality: 80 })
                        .toFile(desktopPath);

                    // 2. Mobile (s rotací a metadaty)
                    await sharp(imageBuffer)
                        .rotate() // Automatická rotace podle EXIF
                        .resize({ width: 800, withoutEnlargement: true })
                        .withMetadata() // Zachová/Opraví EXIF orientaci
                        .webp({ quality: 65 })
                        .toFile(mobilePath);

                    processedCount++;
                } catch (err) {
                    console.error(`❌ Chyba při konverzi ${file}:`, err.message);
                }
            }
        }

        console.log(`✅ Hotovo. Opraveno ${processedCount} obrázků.`);

    } catch (err) {
        console.error('❌ Kritická chyba:', err);
    }
};

run();
