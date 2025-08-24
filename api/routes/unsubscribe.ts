/**
 * Copyright (c) 2024-2025 Rinawarp Technologies, LLC. All rights reserved.
 * Licensed under the MIT License.
 */

import express from 'express';
import { unsubscribeTokenService } from '../services/unsubscribe-token';
import { unsubscribeHandler } from '../services/unsubscribe-handler';

const router = express.Router();

// HTML template for unsubscribe confirmation
const getUnsubscribeTemplate = (message: string, success: boolean) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Email Preferences Updated</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      margin: 0;
      padding: 20px;
      display: flex;
      min-height: 100vh;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
    }
    .container {
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      max-width: 500px;
      width: 100%;
      text-align: center;
    }
    h1 {
      color: ${success ? '#28a745' : '#dc3545'};
      margin-bottom: 20px;
    }
    p {
      color: #666;
      margin-bottom: 30px;
    }
    .icon {
      font-size: 48px;
      margin-bottom: 20px;
    }
    .button {
      display: inline-block;
      padding: 10px 20px;
      background: #007bff;
      color: white;
      text-decoration: none;
      border-radius: 5px;
      transition: background 0.2s;
    }
    .button:hover {
      background: #0056b3;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">${success ? '✅' : '❌'}</div>
    <h1>${success ? 'Successfully Updated' : 'Error'}</h1>
    <p>${message}</p>
    <a href="https://rinawarptech.com/settings/notifications" class="button">
      Manage Email Preferences
    </a>
  </div>
</body>
</html>
`;

// Handle unsubscribe requests
router.get('/', async (req, res) => {
  try {
    const { token, type } = req.query;

    if (!token || !type) {
      res.status(400)
        .send(getUnsubscribeTemplate('Invalid unsubscribe link.', false));
      return;
    }

    // Verify token
    const payload = unsubscribeTokenService.verifyToken(token as string);

    // Process unsubscribe
    const result = await unsubscribeHandler.handleUnsubscribe(
      payload.userId,
      type as any
    );

    res.send(getUnsubscribeTemplate(result.message, result.success));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid unsubscribe link';
    res.status(400).send(getUnsubscribeTemplate(message, false));
  }
});

export default router;
