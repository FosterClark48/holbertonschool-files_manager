// controllers/FilesController.js task5 
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dbClient = require('../utils/db');
// const userId = getUserIdFromToken(req.headers['x-token']);

class FilesController {
  static async postUpload(req, res) {

    const { name, type, parentId, isPublic, data } = req.body;

    try {

      const fileAttributes = {
        userId:
        name,
        type,
        isPublic: isPublic || false,
        parentId: parentId || 0,
      };

      if (type === 'folder') {
      } else {
        // Handle file or image
        const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
        if (!fs.existsSync(folderPath)) {
          fs.mkdirSync(folderPath, { recursive: true });
        }
        const localPath = path.join(folderPath, crypto.randomUUID());
        fs.writeFileSync(localPath, Buffer.from(data, 'base64'));
      }

      // Return the new file information
      return res.status(201).json();
    } catch (error) {
      // Handle errors
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = FilesController;
