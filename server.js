import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import setupPostgresRoutes from './postgres.js';
import setupMongoRoutes from './mongo.js';

// __dirname для ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// Разбор JSON в body
app.use(express.json());

// Раздача статических файлов из папки client
app.use(express.static(path.join(__dirname, 'client')));

// Настройка API-маршрутов (до catch-all)
setupPostgresRoutes(app);
setupMongoRoutes(app);

// Catch-all для маршрутов клиента (не начинающихся с /api)
app.get(/^(?!\/api\/).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});