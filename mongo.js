import mongoose from 'mongoose';

export default function setupMongoRoutes(app) {
  let connection = null;
  let currentDb = '';

  function sanitizeIdentifier(id) {
    return id.replace(/[^a-zA-Z0-9_]/g, '');
  }

  // Подключение или переключение базы данных
  app.post('/api/mongo/connect/:db', async (req, res) => {
    const rawDb = req.params.db;
    const dbName = sanitizeIdentifier(rawDb);
    try {
      // Закрываем старое подключение, если есть
      if (connection) {
        await connection.close();
      }
      connection = await mongoose.createConnection(
        `mongodb://localhost:27017/${dbName}`,
        {
          useNewUrlParser: true,
          useUnifiedTopology: true,
        }
      ).asPromise();
      currentDb = dbName;
      res.json({ status: 'success', message: `Connected to MongoDB: ${dbName}` });
    } catch (err) {
      res.status(500).json({ status: 'error', message: 'Connection failed', error: err.message });
    }
  });

  // Список коллекций
  app.get('/api/mongo/:db/collections', async (req, res) => {
    if (!connection || req.params.db !== currentDb) {
      return res.status(400).json({ status: 'error', message: 'Not connected to this DB' });
    }
    try {
      const cols = await connection.db.listCollections().toArray();
      const names = cols.map(c => c.name);
      res.json({ status: 'success', data: names });
    } catch (err) {
      res.status(500).json({ status: 'error', message: 'Failed to fetch collections', error: err.message });
    }
  });

  // Создание коллекции
  app.post('/api/mongo/data/:db/:name', async (req, res) => {
    if (!connection || req.params.db !== currentDb) {
      return res.status(400).json({ status: 'error', message: 'Not connected to this DB' });
    }
    const rawName = req.params.name;
    const name = sanitizeIdentifier(rawName);
    try {
      await connection.db.createCollection(name);
      res.json({ status: 'success', message: `Collection ${name} created` });
    } catch (err) {
      res.status(500).json({ status: 'error', message: 'Create collection failed', error: err.message });
    }
  });

  // Удаление коллекции
  app.delete('/api/mongo/data/:db/:name', async (req, res) => {
    if (!connection || req.params.db !== currentDb) {
      return res.status(400).json({ status: 'error', message: 'Not connected to this DB' });
    }
    const rawName = req.params.name;
    const name = sanitizeIdentifier(rawName);
    try {
      await connection.db.dropCollection(name);
      res.json({ status: 'success', message: `Collection ${name} dropped` });
    } catch (err) {
      res.status(500).json({ status: 'error', message: 'Drop collection failed', error: err.message });
    }
  });

  // Получить документы коллекции
  app.get('/api/mongo/data/:db/:name', async (req, res) => {
    if (!connection || req.params.db !== currentDb) {
      return res.status(400).json({ status: 'error', message: 'Not connected to this DB' });
    }
    const rawName = req.params.name;
    const name = sanitizeIdentifier(rawName);
    try {
      const docs = await connection.db.collection(name).find({}).toArray();
      res.json({ status: 'success', data: docs });
    } catch (err) {
      res.status(500).json({ status: 'error', message: 'Fetch data failed', error: err.message });
    }
  });

  // Upsert документа
  app.put('/api/mongo/data/:db/:name/row', async (req, res) => {
    if (!connection || req.params.db !== currentDb) {
      return res.status(400).json({ status: 'error', message: 'Not connected to this DB' });
    }
    const rawName = req.params.name;
    const name = sanitizeIdentifier(rawName);
    const rowData = req.body;
    try {
      let { _id, ...updateData } = rowData;
      if (!_id || !mongoose.Types.ObjectId.isValid(_id)) {
        _id = new mongoose.Types.ObjectId();
      } else {
        _id = new mongoose.Types.ObjectId(_id);
      }
      await connection.db.collection(name).updateOne(
        { _id },
        { $set: updateData },
        { upsert: true }
      );
      const doc = await connection.db.collection(name).findOne({ _id });
      res.json({ status: 'success', message: 'Document upserted', data: doc });
    } catch (err) {
      res.status(500).json({ status: 'error', message: 'Upsert failed', error: err.message });
    }
  });

  // Удаление документа
  app.delete('/api/mongo/data/:db/:name/row', async (req, res) => {
    if (!connection || req.params.db !== currentDb) {
      return res.status(400).json({ status: 'error', message: 'Not connected to this DB' });
    }
    const rawName = req.params.name;
    const name = sanitizeIdentifier(rawName);
    const { _id } = req.body;
    if (!_id) {
      return res.status(400).json({ status: 'error', message: 'Document _id required' });
    }
    try {
      const result = await connection.db.collection(name).deleteOne({ _id: new mongoose.Types.ObjectId(_id) });
      res.json({ status: 'success', message: result.deletedCount ? 'Document deleted' : 'Not found' });
    } catch (err) {
      res.status(500).json({ status: 'error', message: 'Delete failed', error: err.message });
    }
  });

  // Добавление поля ко всем документам
  app.put('/api/mongo/data/:db/:name/column', async (req, res) => {
    if (!connection || req.params.db !== currentDb) {
      return res.status(400).json({ status: 'error', message: 'Not connected to this DB' });
    }
    const rawName = req.params.name;
    const name = sanitizeIdentifier(rawName);
    const { columnName, defaultValue } = req.body;
    if (!columnName) {
      return res.status(400).json({ status: 'error', message: 'columnName required' });
    }
    try {
      const result = await connection.db
        .collection(name)
        .updateMany({}, { $set: { [columnName]: defaultValue } });
      const docs = await connection.db.collection(name).find({}).toArray();
      res.json({ status: 'success', message: 'Field added', modifiedCount: result.modifiedCount, data: docs });
    } catch (err) {
      res.status(500).json({ status: 'error', message: 'Add field failed', error: err.message });
    }
  });

  // Удаление поля из всех документов
  app.delete('/api/mongo/data/:db/:name/column', async (req, res) => {
    if (!connection || req.params.db !== currentDb) {
      return res.status(400).json({ status: 'error', message: 'Not connected to this DB' });
    }
    const rawName = req.params.name;
    const name = sanitizeIdentifier(rawName);
    const { columnName } = req.body;
    if (!columnName) {
      return res.status(400).json({ status: 'error', message: 'columnName required' });
    }
    try {
      const result = await connection.db
        .collection(name)
        .updateMany({}, { $unset: { [columnName]: '' } });
      res.json({ status: 'success', message: 'Field removed', modifiedCount: result.modifiedCount });
    } catch (err) {
      res.status(500).json({ status: 'error', message: 'Remove field failed', error: err.message });
    }
  });
}
