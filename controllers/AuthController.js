// Controller for authentication-related actions (login, logout, token management)
const sha1 = require('sha1');
const { v4: uuidv4 } = require('uuid');
const atob = require('atob');
const RedisClient = require('../utils/redis');
const DBClient = require('../utils/db');

class AuthController {
  // sign-in the user by generating a new authentication token
  static async getConnect(req, res) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return res.status(401).json({ error: 'Unathorized' });
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = atob(base64Credentials);
    const [email, pswd] = credentials.split(':');

    // Hash the provided password
    const hashedPassword = sha1(pswd);

    // Verify email and hashed password with database
    try {
      const user = await DBClient.users.findOne({ email });
      if (user && user.password === hashedPassword) {
        // User is authenticated
        try {
          const token = uuidv4();
          await RedisClient.set(`auth_${token}`, user._id.toString(), 86400); // store token 24hrs
          return res.status(200).json({ token });
        } catch (redisError) {
          console.error('Redis set error:', redisError);
          return res.status(500).json({ error: 'Internal Server Error' });
        }
      }
      // Authentication failed
      return res.status(401).json({ error: 'Unauthorized' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  // sign-out the user based on the token
  static async getDisconnect(req, res) {
    const token = req.headers['x-token'];
    // Check if token exists in Redis
    const user = await RedisClient.get(`auth_${token}`);
    if (user) {
      // If token exists, delete
      await RedisClient.del(`auth_${token}`);
      return res.sendStatus(204); // No Content response
    }
    // If token no exist, give 401 response
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

module.exports = AuthController;
