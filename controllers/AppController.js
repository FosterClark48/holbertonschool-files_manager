// Controller for general application operations like checking service status
import RedisClient from '../utils/redis';
import DBClient from '../utils/db';

class AppController {
  static async getStatus(req, res) {
    const redisAlive = RedisClient.isAlive();
    const dbAlive = DBClient.isAlive();
    res.status(200).json({ redis: redisAlive, db: dbAlive });
  }

  static async getStats(req, res) {
    const usersCount = await DBClient.nbUsers();
    const filesCount = await DBClient.nbFiles();
    res.status(200).json({ users: usersCount, files: filesCount });
  }
}

module.exports = AppController;
