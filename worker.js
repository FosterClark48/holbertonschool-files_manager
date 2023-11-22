// Background job worker, primarily for tasks like thumbnail generation
// Importing necessary modules
const Queue = require('bull');
const { ObjectId } = require('mongodb');
const imageThumbnail = require('image-thumbnail');
const fs = require('fs');
const path = require('path');
const DBClient = require('./utils/db');

// Initialize a new Bull queue named 'fileQueue'
const fileQueue = new Queue('fileQueue');

// Define the process for handling jobs in the 'fileQueue'
fileQueue.process(async (job) => {
  // Extracting fileId and userId from the job's data
  const { fileId, userId } = job.data;

  // Check if fileId and userId are provided, throw an error if not
  if (!fileId || !userId) {
    throw new Error('Missing fileId or userId');
  }

  // Retrieve the file from the database using fileId and userId
  const file = await DBClient.db.collection('files').findOne({ _id: ObjectId(fileId), userId: ObjectId(userId) });
  // If the file is not found, throw an error
  if (!file) {
    throw new Error('File not found');
  }

  // Get the local path of the file
  const filePath = file.localPath;
  // Define the sizes for the thumbnails
  const sizes = [100, 250, 500];

  // Loop through each size to create a thumbnail
  sizes.forEach(async (size) => {
    // Generate a thumbnail with the specified width
    const thumbnail = await imageThumbnail(filePath, { width: size });
    // Construct the path for the thumbnail file
    const thumbnailPath = path.join(path.dirname(filePath), `${path.basename(filePath, path.extname(filePath))}_${size}${path.extname(filePath)}`);
    // Write the thumbnail to the file system
    fs.writeFileSync(thumbnailPath, thumbnail);
  });
});

// Export the fileQueue for use in other parts of the application
module.exports = fileQueue;
