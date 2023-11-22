// controllers/FilesController.js task5, task6, task7, task8
// External module imports
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const mimeType = require('mime-types');
const { ObjectId } = require('mongodb');
const Queue = require('bull');

// Local module imports
const DBClient = require('../utils/db');
const RedisClient = require('../utils/redis');

// Queue initialization
const fileQueue = new Queue('fileQueue');

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

      if (type === 'image') {
        // Add a job to the Bull queue for processing the image
        fileQueue.add({
          userId: objectIdUserId.toString(),
          fileId: fileData.id.toString(),
        });
      }

      // Return the new file information
      return res.status(201).json(fileData);
    } catch (error) {
      // Handle errors
      console.error('Error in postUpload:', error);
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

    // Retrieve user ID from token
    let userId;
    try {
      userId = await getUserIdFromToken(token);
      if (!userId) {
        throw new Error('Unauthorized');
      }
    } catch (error) {
      console.error(error);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Extract parentId and page from query parameters
    const parentId = req.query.parentId || '0';
    const page = parseInt(req.query.page, 10) || 0;
    const skip = page * 20;

    try {
      // Construct query for aggregation pipeline
      const matchQuery = { userId: new ObjectId(userId) };
      if (parentId !== '0') {
        matchQuery.parentId = new ObjectId(parentId);
      } else {
        matchQuery.parentId = '0';
      }

      // Use aggregation for efficient querying and pagination
      const files = await DBClient.db.collection('files').aggregate([
        { $match: matchQuery },
        { $skip: skip },
        { $limit: 20 },
      ]).toArray();

      // Transform files for response
      const transformedFiles = files.map((file) => ({
        id: file._id.toString(),
        userId: file.userId.toString(),
        name: file.name,
        type: file.type,
        isPublic: file.isPublic,
        parentId: file.parentId.toString(),
      }));

      return res.status(200).json(transformedFiles);
    } catch (error) {
      console.error('Error in getIndex:', error);
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

  static async getFile(req, res) {
    const fileId = req.params.id;
    const token = req.headers['x-token'];
    let userId = null;

    if (token) {
      userId = await getUserIdFromToken(token);
      if (userId) userId = new ObjectId(userId);
    }

    try {
      const file = await DBClient.db.collection('files').findOne({ _id: new ObjectId(fileId) });

      if (!file) return res.status(404).json({ error: 'Not found' });
      if (file.type === 'folder') return res.status(400).json({ error: "A folder doesn't have content" });
      if (!file.isPublic && (!userId || !userId.equals(file.userId))) {
        return res.status(404).json({ error: 'Not found' });
      }

      const { localPath } = file;
      const { size } = req.query;
      let filePath = localPath;

      if (size) {
        const sizes = ['100', '250', '500'];
        if (!sizes.includes(size)) {
          return res.status(400).json({ error: 'Invalid size parameter' });
        }

        // Construct the path for the thumbnail
        const thumbnailPath = path.join(path.dirname(localPath), `${path.basename(localPath, path.extname(localPath))}_${size}${path.extname(localPath)}`);
        if (!fs.existsSync(thumbnailPath)) {
          return res.status(404).json({ error: 'Thumbnail not found' });
        }
        filePath = thumbnailPath;
      }

      if (!fs.existsSync(localPath)) return res.status(404).json({ error: 'File not found' });

      // Set the MIME type for the response and stream the thumbnail
      const mimeTypeValue = mimeType.lookup(filePath) || 'application/octet-stream';
      res.setHeader('Content-Type', mimeTypeValue);
      return fs.createReadStream(filePath).pipe(res);
    } catch (error) {
      console.error('Error in getFile:', error);
      return res.status(500).json({ error: 'Internal server error ' });
    }
  }
}

module.exports = FilesController;
