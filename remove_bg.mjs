import { Jimp, intToRGBA, rgbaToInt } from 'jimp';

async function processImage(inputPath, outputPath) {
  try {
    const image = await Jimp.read(inputPath);
    
    // We'll iterate through all pixels.
    // If a pixel is very dark (close to black), we make it transparent.
    // We'll use a threshold distance from black (0,0,0).
    const threshold = 40; 
    
    // Smooth blending edge
    const feather = 30;

    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
      const r = this.bitmap.data[idx + 0];
      const g = this.bitmap.data[idx + 1];
      const b = this.bitmap.data[idx + 2];
      
      // Calculate luminance or max color value
      const brightness = Math.max(r, g, b);

      if (brightness < threshold) {
        // Pure black -> 0 alpha
        this.bitmap.data[idx + 3] = 0; 
      } else if (brightness < threshold + feather) {
        // Feather the edge
        const alpha = ((brightness - threshold) / feather) * 255;
        this.bitmap.data[idx + 3] = Math.min(255, Math.max(0, alpha));
      }
    });

    await image.write(outputPath);
    console.log(`Successfully processed ${inputPath}`);
  } catch (err) {
    console.error(`Error processing ${inputPath}:`, err);
  }
}

async function run() {
  await processImage(
    'apps/public/public/images/dancer_left.png',
    'apps/public/public/images/transparent_left.png'
  );
  await processImage(
    'apps/public/public/images/dancer_right.png',
    'apps/public/public/images/transparent_right.png'
  );
}

run();
