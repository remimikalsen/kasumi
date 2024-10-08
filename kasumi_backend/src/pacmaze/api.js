const express = require('express');
const db = require('../common/db');

const router = express.Router();

// Create a table for the leaderboard
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS pacmaze_leaderboard (initials TEXT, time REAL)`);
});

// Endpoint to submit a score
router.post('/pacmaze/submit_score', (req, res) => {
  const { initials, time } = req.body;

  if (!initials || !time) {
    return res.status(400).send('Missing initials or time value');
  }

  // Convert time to a real/float number
  const parsedTime = parseFloat(time);
  if (isNaN(parsedTime)) {
    return res.status(400).send('Invalid time value');
  }
  
  const stmt = db.prepare('INSERT INTO pacmaze_leaderboard (initials, time) VALUES (?, ?)');
  stmt.run(initials, time, function(err) {
    if (err) {
      res.status(500).send('Database error');
    } else {
      res.sendStatus(200);
    }
  });
});

// Endpoint to get the leaderboard
router.get('/pacmaze/get_leaderboard', (req, res) => {
  db.all(`
    SELECT initials, MIN(time) as time 
    FROM pacmaze_leaderboard 
    GROUP BY initials 
    ORDER BY time ASC 
    LIMIT 10
  `, [], (err, rows) => {
    if (err) {
      res.status(500).send('Database error');
    } else {
      res.json(rows);
    }
  });
});


// Endpoint to clear initials with certain scores from leaderboard
router.post('/pacmaze/delete_score', (req, res) => {
  const { initials, time } = req.body;

  // Corrected SQL syntax for DELETE query
  const stmt = db.prepare('DELETE FROM pacmaze_leaderboard WHERE initials = ? AND ROUND(time, 2) = ?');

  // Executing the statement with provided parameters
  stmt.run(initials, time, function(err) {
    if (err) {
      res.status(500).send('Database error');
    } else {
      res.status(200).send({ deletedRows: this.changes });
    }
  });
});

module.exports = router;