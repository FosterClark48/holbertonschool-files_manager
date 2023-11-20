// Entry point of the application, setting up the server and middleware
const express = require('express');

const app = express();
const port = process.env.PORT || 5000;

const routes = require('./routes/index');

app.use(express.json());
app.use(routes);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

module.exports = app;
