// Central routing file, importing and consolidating routes from various controllers
import express from 'express';
import UsersController from '../controllers/UsersController';

const router = express.Router();

router.post('/users', UsersController.postNew);

export default router;
