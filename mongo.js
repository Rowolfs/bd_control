import mongoose from 'mongoose';

export default function setupMongoRoutes(app) {
    let db_name;

    async function mongo_connect(db_name) {
        try {
            await mongoose.connect(`mongodb://localhost:27017/${db_name}`, {});
            console.log(`Connected to MongoDB ${db_name}`);
        } catch (err) {
            console.error(`MongoDB connection error:`, err);
        }
    }

    app.post("/api/mongo/connect/:db_name", async (req, resp) => {
        db_name = req.params.db_name;
        try {
            await mongo_connect(db_name);
            resp.status(200).json({ status: "success", message: `Connected to MongoDB: ${db_name}` });
        } catch (err) {
            resp.status(500).json({ status: "error", message: "Connection to DB failed", error: err.message });
        }
    });

    app.get("/api/mongo/collections", async (_, resp) => {
        try {
            const db = mongoose.connection.db;
            if (!db) {
                throw new Error('MongoDB connection not established');
            }
            const collections = await db.listCollections().toArray();
            const names = collections.map(col => col.name);
            resp.status(200).json({
                status: "success",
                data: names
            });
        } catch (err) {
            resp.status(500).json({
                status: "error",
                message: "Failed to fetch collections",
                error: err.message
            });
        }
    });


    app.post(`/api/mongo/data/:name`, async (req, resp) => {
        try {
            const db = mongoose.connection.db;
            const name = req.params.name;
            if (!db) {
                throw new Error('MongoDB connection not established');
            }
            await db.createCollection(name);
            resp.status(200).json({
                status: "success",
                message: `Successfully created collection ${name}`
            });
        } catch (err) {
            resp.status(500).json({
                status: "error",
                message: "Failed to create collection",
                error: err.message
            });
        }
    });

    app.get(`/api/mongo/data/:name`, async (req, resp) => {
        try {
            const db = mongoose.connection.db;
            if (!db) {
                throw new Error('MongoDB connection not established');
            }
            const collectionName = req.params.name;
            const collection = db.collection(collectionName);
            const documents = await collection.find({}).toArray();
            resp.status(200).json({
                status: "success",
                data: documents
            });
        } catch (err) {
            resp.status(500).json({
                status: "error",
                message: "Failed to fetch data",
                error: err.message
            });
        }
    });


    app.put(`/api/mongo/data/:name/row`, async (req, resp) => {
        try {
            const db = mongoose.connection.db;
            if (!db) {
                throw new Error('MongoDB connection not established');
            }

            const collectionName = req.params.name;
            const rowData = req.body;
            let { _id, ...updateData } = rowData;

            // Generate a new ObjectId if `_id` is not provided or invalid
            if (!_id || !mongoose.Types.ObjectId.isValid(_id)) {
                _id = new mongoose.Types.ObjectId();
            } else {
                _id = new mongoose.Types.ObjectId(_id);
            }

            const collection = db.collection(collectionName);

            // Check if the document exists
            const existingDocument = await collection.findOne({ _id: _id });

            let result;
            if (existingDocument) {
                // Update the document if it exists
                result = await collection.updateOne(
                    { _id: _id },
                    { $set: updateData },
                    { upsert: true }
                );

                const updatedDocument = await collection.findOne({ _id: _id });

                resp.status(200).json({
                    status: "success",
                    message: "Row updated successfully",
                    data: updatedDocument
                });
            } else {
                // Delete the document if it doesn't exist
                result = await collection.deleteOne({ _id: _id });

                resp.status(200).json({
                    status: "success",
                    message: "Row not found, so it was deleted",
                    deletedCount: result.deletedCount
                });
            }
        } catch (err) {
            resp.status(500).json({
                status: "error",
                message: "Failed to upsert or delete row",
                error: err.message
            });
        }
    });

    app.delete(`/api/mongo/data/:name/row`, async (req, resp) => {
        try {
            const db = mongoose.connection.db;
            if (!db) {
                throw new Error('MongoDB connection not established');
            }
            const collectionName = req.params.name;
            const { _id } = req.body;
            const collection = db.collection(collectionName);

            const result = await collection.deleteOne({ _id: new mongoose.Types.ObjectId(_id) });
            resp.status(200).json({
                status: "success",
                message: result.deletedCount > 0 ? "Row deleted successfully" : "No row found to delete"
            });
        } catch (err) {
            resp.status(500).json({
                status: "error",
                message: "Failed to delete row",
                error: err.message
            });
        }
    });

    app.put(`/api/mongo/data/:name/column`, async (req, resp) => {
        try {
            const db = mongoose.connection.db;
            if (!db) {
                throw new Error('MongoDB connection not established');
            }
            const collectionName = req.params.name;
            const { columnName, defaultValue } = req.body;

            const collection = db.collection(collectionName);
            const result = await collection.updateMany({}, { $set: { [columnName]: defaultValue } });

            const updatedDocuments = await collection.find({}).toArray();
            resp.status(200).json({
                status: "success",
                message: "Column added successfully",
                modifiedCount: result.modifiedCount,
                data: updatedDocuments
            });
        } catch (err) {
            resp.status(500).json({
                status: "error",
                message: "Failed to add column",
                error: err.message
            });
        }
    });

    app.delete(`/api/mongo/data/:name/column`, async (req, resp) => {
        try {
            const db = mongoose.connection.db;
            if (!db) {
                throw new Error('MongoDB connection not established');
            }
            const collectionName = req.params.name;
            const { columnName } = req.body;

            const collection = db.collection(collectionName);
            const result = await collection.updateMany({}, { $unset: { [columnName]: "" } });

            resp.status(200).json({
                status: "success",
                message: "Column deleted successfully",
                modifiedCount: result.modifiedCount
            });
        } catch (err) {
            resp.status(500).json({
                status: "error",
                message: "Failed to delete column",
                error: err.message
            });
        }
    });
}
