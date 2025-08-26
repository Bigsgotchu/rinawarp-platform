import express from 'express';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Serve documentation files
router.get('/*', (req, res) => {
    const docPath = req.path === '/' ? 'index.html' : req.path;
    const filePath = path.join(process.cwd(), 'public', 'docs', docPath);
    
    console.log('Documentation request:', {
        requestPath: req.path,
        docPath,
        filePath,
        exists: fs.existsSync(filePath)
    });

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({
            error: {
                message: 'Documentation page not found',
                path: req.path
            }
        });
    }

    const ext = path.extname(filePath);
    const contentType = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript'
    }[ext] || 'text/plain';

    res.setHeader('Content-Type', contentType);
    res.sendFile(filePath);
});

export default router;
