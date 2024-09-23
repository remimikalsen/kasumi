const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dogrun = require('./dogrun/api');
const pacmaze = require('./pacmaze/api');

const app = express();

app.use(cors());
app.use(bodyParser.json());

// Use sub-project routes
app.use('/api', dogrun);
app.use('/api', pacmaze);

app.listen(3000, () => {
  console.log('Backend server running on port 3000');
});