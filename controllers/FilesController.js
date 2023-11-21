// controllers/FilesController.js task5, task6, task7, task8
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { ObjectId } = require('mongodb');
const DBClient = require('../utils/db');
const RedisClient = require('../utils/redis');

// Helper function to get user ID from token
async function getUserIdFromToken(token) {
  try {
    const userId = await RedisClient.get(`auth_${token}`);
    return userId;
  } catch (error) {
    console.error('Error in getUserIdFromToken:', error);
    return null;
  }
}

class FilesController {
  static async postUpload(req, res) {
    const {
      name, type, parentId, isPublic, data,
    } = req.body;
    const token = req.headers['x-token'];

    // Validate required fields
    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }
    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }
    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    // Authenticate user
    const userId = await getUserIdFromToken(token);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const objectIdUserId = new ObjectId(userId);

    try {
    // Parent ID validation
      if (parentId) {
        if (!ObjectId.isValid(parentId)) {
          return res.status(400).json({ error: 'Invalid Parent ID' });
        }
        const parent = await DBClient.db.collection('files').findOne({ _id: new ObjectId(parentId) });
        if (!parent) {
          return res.status(400).json({ error: 'Parent not found' });
        }
        if (parent.type !== 'folder') {
          return res.status(400).json({ error: 'Parent is not a folder' });
        }
      }

      let fileData = {
        userId: objectIdUserId,
        name,
        type,
        isPublic: isPublic || false,
        parentId: parentId && parentId !== '0' ? new ObjectId(parentId) : 0,
      };

      if (type === 'folder') {
        // Insert folder data into MongoDB
        const result = await DBClient.db.collection('files').insertOne(fileData);
        fileData = { ...fileData, id: result.insertedId };
      } else {
        // Handle file or image
        const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
        if (!fs.existsSync(folderPath)) {
          fs.mkdirSync(folderPath, { recursive: true });
        }
        const localPath = path.join(folderPath, uuidv4());
        fs.writeFileSync(localPath, Buffer.from(data, 'base64'));

        fileData = { ...fileData, localPath };
        // Insert file data into MongoDB
        const result = await DBClient.db.collection('files').insertOne(fileData);
        fileData = { ...fileData, id: result.insertedId };
      }

      // Return the new file information
      return res.status(201).json(fileData);
    } catch (error) {
      // Handle errors
      console.error('Error in postUpload:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async putPublish(req, res) {
    const fileId = req.params.id;
    const token = req.headers['x-token'];

    const userId = await getUserIdFromToken(token);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const result = await DBClient.db.collection('files').findOneAndUpdate(
        { _id: new ObjectId(fileId), userId: new ObjectId(userId) },
        { $set: { isPublic: true } },
        { returnDocument: 'after' },
      );

      if (!result.value) {
        return res.status(404).json({ error: 'Not found' });
      }

      return res.status(200).json(result.value);
    } catch (error) {
      console.error('Error in putPublish:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async putUnpublish(req, res) {
    const fileId = req.params.id;
    const token = req.headers['x-token'];

    const userId = await getUserIdFromToken(token);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const result = await DBClient.db.collection('files').findOneAndUpdate(
        { _id: new ObjectId(fileId), userId: new ObjectId(userId) },
        { $set: { isPublic: false } },
        { returnDocument: 'after' },
      );

      if (!result.value) {
        return res.status(404).json({ error: 'Not found' });
      }

      return res.status(200).json(result.value);
    } catch (error) {
      console.error('Error in putUnpublish:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get file based on user ID
  static async getShow(req, res) {
    const token = req.headers['x-token'];
    // Verify user based on token, if unauthorized - 401
    const userId = await getUserIdFromToken(token);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const fileId = req.params.id;
    if (!Object.isValid(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID' });
    }

    try {
      // Check if file w/ provided ID exists & belongs to authenticated user
      const file = await DBClient.db.collection('files').findOne({ _id: new ObjectId(fileId), userId: new ObjectId(userId) });
      // If file doesn't exist - 404 - otherwise return file info
      if (!file) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json(file);
    } catch (error) {
      console.error('Error in getShow:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get all files from parentID with pagination
  static async getIndex(req, res) {
    const token = req.headers['x-token'];
    // Retrieve userID from token, if not found - 401
    const userId = await getUserIdFromToken(token);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Extract parentID and page number from query params, w/ defaults
    // Set default parentId to '0' (root) if not provided
    const parentId = req.query.parentId ? req.query.parentId : '0';
    const page = parseInt(req.query.page, 10) || 0;
    try {
      // Query 'files' collection for files belonging to user
      // Apply filtering based on parentID & pagination
      const filesQuery = { userId: ObjectId(userId), parentId: ObjectId(parentId) };
      const totalFiles = await DBClient.db.collection('files').countDocuments(filesQuery);

      const files = await DBClient.db.collection('files')
        .find(filesQuery)
        .skip(page * 20) // Display next 20 docs on next page, etc.
        .limit(20) // Limit the result to 20 docs per page
        .toArray();

      // Check if page number is too far
      if (page > 0 && files.length === 0 && totalFiles > 0) {
        return res.status(404).json({ error: 'No files found on this page' });
      }
      // Return fetched files
      return res.status(200).json(files);
    } catch (error) {
      console.error('Error in getIndex:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = FilesController;
