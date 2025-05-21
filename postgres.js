import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const host = process.env.DB_HOST;
const port = process.env.DB_PORT;
const user = process.env.DB_USER;
const password = process.env.DB_PASSWORD;

let pool;

function sanitizeIdentifier(identifier) {
  return identifier.replace(/[^a-zA-Z0-9_]/g, '');
}

export default function setupPostgresRoutes(app) {
  // Подключение или создание базы данных
  app.post('/api/postgres/connect/:db', async (req, res) => {
    const rawDb = req.params.db;
    const database = sanitizeIdentifier(rawDb);
    try {
      pool = new Pool({ host, port, user, password, database });
      await pool.query('SELECT 1');
      res.json({ status: 'success', message: `Connected to ${database}` });
    } catch (err) {
      if (err.message.includes(`database "${rawDb}" does not exist`)) {
        try {
          const temp = new Pool({ host, port, user, password, database: 'postgres' });
          await temp.query(`CREATE DATABASE "${database}"`);
          await temp.end();
          pool = new Pool({ host, port, user, password, database });
          res.status(201).json({ status: 'success', message: `Database ${database} created and connected` });
        } catch (createErr) {
          res.status(500).json({ status: 'error', message: 'Failed to create database', error: createErr.message });
        }
      } else {
        res.status(500).json({ status: 'error', message: 'Connection failed', error: err.message });
      }
    }
  });

  // Список таблиц в базе
  app.get('/api/postgres/:db/tables', async (req, res) => {
    if (!pool) return res.status(400).json({ status: 'error', message: 'Not connected' });
    try {
      const result = await pool.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';`
      );
      res.json({ status: 'success', data: result.rows.map(r => r.table_name) });
    } catch (err) {
      res.status(500).json({ status: 'error', message: 'Failed to fetch tables', error: err.message });
    }
  });

  // Создание таблицы
  app.post('/api/postgres/:db', async (req, res) => {
    if (!pool) return res.status(400).json({ status: 'error', message: 'Not connected' });
    const { table } = req.body;
    if (!table) {
      return res.status(400).json({ status: 'error', message: 'table required' });
    }
    const tableName = sanitizeIdentifier(table);
    // Поддерживаем raw SQL или формат name:type,name2:type2
    try {
      await pool.query(`CREATE TABLE IF NOT EXISTS ${tableName} (id SERIAL PRIMARY KEY);`);
      res.json({ status: 'success', message: `Table ${tableName} created` });
    } catch (err) {
      res.status(500).json({ status: 'error', message: 'Create table failed', error: err.message });
    }
  });

  // Удаление таблицы
  app.delete('/api/postgres/:db/:table', async (req, res) => {
    if (!pool) return res.status(400).json({ status: 'error', message: 'Not connected' });
    const tableName = sanitizeIdentifier(req.params.table);
    try {
      await pool.query(`DROP TABLE IF EXISTS "${tableName}";`);
      res.json({ status: 'success', message: `Table ${tableName} dropped` });
    } catch (err) {
      res.status(500).json({ status: 'error', message: 'Drop table failed', error: err.message });
    }
  });

  app.get('/api/postgres/:db/:table', async (req, res) => {
    if (!pool) return res.status(400).json({ status: 'error', message: 'Not connected' });
    const tableName = sanitizeIdentifier(req.params.table);
    try {
      // Получаем колонки
      const hdrRes = await pool.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = $1 AND table_schema = 'public'
         ORDER BY ordinal_position;`, [tableName]
      );
      const headers = hdrRes.rows.map(r => r.column_name);
      // Получаем данные
      const dataRes = await pool.query(`SELECT * FROM "${tableName}";`);
      res.json({ status: 'success', headers, data: dataRes.rows });
    } catch (err) {
      res.status(500).json({ status: 'error', message: 'Fetch data failed', error: err.message });
    }
  });

  // Upsert строк
  app.put('/api/postgres/:db/:table/rows', async (req, res) => {
    if (!pool) return res.status(400).json({ status: 'error', message: 'Not connected' });
    const tableName = sanitizeIdentifier(req.params.table);
    const { keys, values } = req.body;
    if (!Array.isArray(keys) || !Array.isArray(values)) {
      return res.status(400).json({ status: 'error', message: 'Invalid payload' });
    }
    const colsCount = keys.length;
    const rowsCount = values.length;
    const columns = keys.map(k => `"${sanitizeIdentifier(k)}"`).join(', ');
    const flat = values.flat();
    const placeholders = values.map((_, i) => {
      const start = i * colsCount + 1;
      return `(${keys.map((__, j) => `$${start + j}`).join(',')})`;
    }).join(',');
    const updateSet = keys.filter(k => k !== 'id')
      .map(k => `"${sanitizeIdentifier(k)}" = EXCLUDED."${sanitizeIdentifier(k)}"`).join(', ');
    const sql = `INSERT INTO "${tableName}" (${columns}) VALUES ${placeholders} ON CONFLICT (id) DO UPDATE SET ${updateSet};`;
    try {
      await pool.query(sql, flat);
      res.json({ status: 'success', message: `Upserted ${rowsCount} rows` });
    } catch (err) {
      res.status(500).json({ status: 'error', message: 'Upsert failed', error: err.message });
    }
  });

  // Добавление колонки
  app.put('/api/postgres/:db/:table/column', async (req, res) => {
    if (!pool) return res.status(400).json({ status: 'error', message: 'Not connected' });
    const tableName = sanitizeIdentifier(req.params.table);
    const { columnName, columnType } = req.body;
    if (!columnName || !columnType) {
      return res.status(400).json({ status: 'error', message: 'columnName and columnType required' });
    }
    try {
      await pool.query(`ALTER TABLE "${tableName}" ADD COLUMN "${sanitizeIdentifier(columnName)}" ${columnType};`);
      res.json({ status: 'success', message: `Column ${columnName} added` });
    } catch (err) {
      res.status(500).json({ status: 'error', message: 'Add column failed', error: err.message });
    }
  });

  // Удаление колонки
  app.delete('/api/postgres/:db/:table/column', async (req, res) => {
    if (!pool) return res.status(400).json({ status: 'error', message: 'Not connected' });
    const tableName = sanitizeIdentifier(req.params.table);
    const { columnName } = req.body;
    if (!columnName) {
      return res.status(400).json({ status: 'error', message: 'columnName required' });
    }
    try {
      await pool.query(`ALTER TABLE "${tableName}" DROP COLUMN "${sanitizeIdentifier(columnName)}";`);
      res.json({ status: 'success', message: `Column ${columnName} dropped` });
    } catch (err) {
      res.status(500).json({ status: 'error', message: 'Drop column failed', error: err.message });
    }
  });

  // Удаление строки
  app.delete('/api/postgres/:db/:table/row', async (req, res) => {
    if (!pool) return res.status(400).json({ status: 'error', message: 'Not connected' });
    const tableName = sanitizeIdentifier(req.params.table);
    const { id } = req.body;
    if (id == null) {
      return res.status(400).json({ status: 'error', message: 'id required' });
    }
    try {
      const result = await pool.query(`DELETE FROM "${tableName}" WHERE id = $1;`, [id]);
      res.json({ status: 'success', message: result.rowCount ? 'Row deleted' : 'Row not found' });
    } catch (err) {
      res.status(500).json({ status: 'error', message: 'Delete row failed', error: err.message });
    }
  });
}
