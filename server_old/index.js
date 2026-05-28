import app from './app.js';

const port = process.env.PORT || 8787;

app.listen(port, () => {
  console.log(`AI Question Bank API running on http://localhost:${port}`);
});
