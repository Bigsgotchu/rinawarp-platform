const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const icongen = require('icon-gen');

const SIZES = {
  mac: [16, 32, 64, 128, 256, 512, 1024],
  win: [16, 24, 32, 48, 64, 128, 256],
  linux: [16, 32, 48, 64, 128, 256, 512],
};

async function generateIcons() {
  const sourceSvg = path.join(__dirname, '../assets/icons/icon.svg');
  const outputDir = path.join(__dirname, '../assets/icons/generated');

  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });

  // Generate PNG files for each size
  for (const size of new Set([...SIZES.mac, ...SIZES.win, ...SIZES.linux])) {
    await sharp(sourceSvg)
      .resize(size, size)
      .png()
      .toFile(path.join(outputDir, `icon-${size}.png`));
  }

  // Generate macOS ICNS
  await icongen(sourceSvg, outputDir, {
    report: true,
    ico: {
      name: 'icon',
      sizes: SIZES.win,
    },
    icns: {
      name: 'icon',
      sizes: SIZES.mac,
    },
    png: {
      name: 'icon',
      sizes: SIZES.linux,
    },
  });

  console.log('Icon generation complete!');
}

generateIcons().catch(console.error);
