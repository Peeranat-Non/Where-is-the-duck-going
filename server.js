import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Health check endpoint for Cloud Run / container ingress
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

// Serve static files from root directory
app.use(express.static(__dirname));

// Direct route for /
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

// Fallback to index.html for SPA/client routing
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
