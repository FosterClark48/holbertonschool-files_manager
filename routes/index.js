// Central routing file, importing and consolidating routes from various controllers
const express = require('express');

const AppController = require('../controllers/AppController');
const UsersController = require('../controllers/UsersController');
const AuthController = require('../controllers/AuthController');
// const FilesController = require('../controllers/FilesController');

const router = express.Router();

// GET routes
router.get('/status', AppController.getStatus);
router.get('/stats', AppController.getStats);
router.get('/connect', AuthController.getConnect);
router.get('/disconnect', AuthController.getDisconnect);
router.get('/users/me', UsersController.getMe);

// POST routes
router.post('/users', UsersController.postNew);
// router.post('/files', FilesController.postUpload);

module.exports = router;
