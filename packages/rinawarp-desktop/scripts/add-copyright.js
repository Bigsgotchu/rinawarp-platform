const fs = require('fs').promises;
const path = require('path');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

const COPYRIGHT_HEADER = `/**
 * Copyright (c) 2025 RinaWarp Technologies, LLC. All Rights Reserved.
 * 
 * This file is part of RinaWarp Terminal.
 * 
 * Proprietary and confidential. Unauthorized copying of this file, via any medium,
 * is strictly prohibited.
 */
`;

const SOURCE_DIRS = ['src', 'scripts', 'electron'];
const FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

async function findSourceFiles(dir) {
  const files = [];
  
  async function walk(currentPath) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        await walk(fullPath);
      } else if (entry.isFile() && FILE_EXTENSIONS.includes(path.extname(entry.name))) {
        files.push(fullPath);
      }
    }
  }
  
  await walk(dir);
  return files;
}

async function addCopyrightHeader(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  
  // Skip if file already has copyright header
  if (content.includes('RinaWarp Technologies, LLC')) {
    console.log(`Skipping ${filePath} - already has copyright header`);
    return;
  }
  
  const newContent = COPYRIGHT_HEADER + '\n' + content;
  await fs.writeFile(filePath, newContent);
  console.log(`Added copyright header to ${filePath}`);
}

async function main() {
  for (const dir of SOURCE_DIRS) {
    const dirPath = path.join(__dirname, '..', dir);
    try {
      const files = await findSourceFiles(dirPath);
      for (const file of files) {
        await addCopyrightHeader(file);
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`Skipping directory ${dir} - does not exist`);
      } else {
        console.error(`Error processing directory ${dir}:`, error);
      }
    }
  }
  
  console.log('\nDone! Copyright headers have been added to all source files.');
}

main().catch(console.error);
