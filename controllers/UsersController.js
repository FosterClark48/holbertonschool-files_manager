// Controller for user-related operations (user creation and management)
const crypto = require('crypto');
const { ObjectID } = require('mongodb');
const dbClient = require('../utils/db');
const RedisClient = require('../utils/redis');

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;

    // Check for missing email or password
    if (!email) return res.status(400).json({ error: 'Missing email' });
    if (!password) return res.status(400).json({ error: 'Missing password' });

    // check if email already exists
    const existingUser = await dbClient.db.collection('users').findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'Already exist' });

    // Hash password with SHA1
    const hash = crypto.createHash('sha1').update(password).digest('hex');

    // Insert new user into database
    const newUser = await dbClient.db.collection('users').insertOne({
      email,
      password: hash,
    });

    // Return new user info
    return res.status(201).json({ id: newUser.insertedId, email });
  }

  // retrieve the user base on the token used
  static async getMe(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      // Get user ID string associated w/ token from Redis
      const userIdString = await RedisClient.get(`auth_${token}`);
      if (!userIdString) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Convert user ID string to MongoDB's ObjectID
      const userId = new ObjectID(userIdString);
      // Find user by ID from db
      const user = await dbClient.users.findOne({ _id: userId });
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Return users ID and email, converting it from ObjectID to string for response
      return res.status(200).json({ id: user._id.toString(), email: user.email });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

module.exports = UsersController;
