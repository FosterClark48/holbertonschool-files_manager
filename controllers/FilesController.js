// controllers/FilesController.js task5
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

  static async getShow(req, res) {
    const token = req.headers['x-token'];
    const userId = await getUserIdFromToken(token);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const fileId = req.params.id;
    try {
      const file = await DBClient.db.collection('files').findOne({ _id: ObjectId(fileId), userId: ObjectId(userId) });
      if (!file) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json(file);
    } catch (error) {
      console.error('Error in getShow:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = FilesController;
