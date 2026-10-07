const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const imgDir = path.join(__dirname, 'apps/public/public/images');
const files = fs.readdirSync(imgDir);

async function compressAll() {
  for (const file of files) {
    if (file.endsWith('.png')) {
      const inputPath = path.join(imgDir, file);
      const outputFilename = file.replace('.png', '.webp');
      const outputPath = path.join(imgDir, outputFilename);
      
      console.log(`Compressing ${file}...`);
      await sharp(inputPath)
        .webp({ quality: 80, effort: 6 })
        .toFile(outputPath);
      
      console.log(`Saved as ${outputFilename}`);
      
      // We will keep the png for now but later we update references and delete it
    }
  }
}

compressAll().catch(console.error);
