// MongoDB utility class for database operations
import { MongoClient } from 'mongodb';

class DBClient {
  constructor() {
    this.db = null;
    this.connectMongo();
  }

async connectMongo() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || 'files_manager';

    const url = `mongodb://${host}:${port}`;

    try {
        this.client = new MongoClient(url, { useNewUrlParser: true, useUnifiedTopology: true });
      await this.client.connect();
      this.db = this.client.db(database);
      console.log("Connected to MongoDB");
    } catch (error) {
        console.error("Failed to connect to MongoDB", error);
    }
}

  async isAlive() {
    if (!this.db) {
        return false;
    }
    try {
      await this.db.command({ ping: 1});
      return true;
    } catch (error) {
      return false;
   }
  }

  async nbUsers() {
    return this.db.collection('users').countDocuments();
  }

  async nbFiles() {
    return this.db.collection('files').countDocuments();
  }

}

const dbClient = new DBClient();
export default dbClient;
