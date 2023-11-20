// Controller for general application operations like checking service status
const RedisClient = require('../utils/redis');
const DBClient = require('../utils/db');

class AppController {
  static async getStatus(req, res) {
    const redisAlive = RedisClient.isAlive();
    const dbAlive = DBClient.isAlive();
    res.status(200).send({ redis: redisAlive, db: dbAlive });
  }

  static async getStats(req, res) {
    const usersCount = await DBClient.nbUsers();
    const filesCount = await DBClient.nbFiles();
    res.status(200).send({ users: usersCount, files: filesCount });
  }
}

module.exports = AppController;
