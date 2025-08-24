import { Request, Response, NextFunction } from 'express';

export const adminAuth = (req: Request, res: Response, next: NextFunction) => {
  const testToken = req.header('X-Test-Token');
  
  // In production, this would be a proper auth check
  if (testToken === 'test_only_2024') {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};
