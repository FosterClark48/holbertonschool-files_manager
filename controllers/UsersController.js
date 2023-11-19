// Controller for user-related operations (user creation and management)
import crypto from 'crypto';
import dbClient from '../utils/db';

class UsersController {
    static async postNew(req, res) {
        const { email, password } = req.body;

        // Check for missing email or password
        if (!email) return res.status(400).json({ error: 'Missing email' });
        if (!password) return res.status(400).json({ error: 'Missing password'});

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
}

export default UsersController;
