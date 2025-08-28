import app from './app';

const port = process.env.PORT || 3000;

// Start server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log(`Rate limiting and security middleware enabled`);
});
