const express = require('express');
const db = require('../common/db');
const { parseInitials, parseNumber } = require('../common/validate');

const router = express.Router();

// Create a table for the leaderboard
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS pacmaze_leaderboard (initials TEXT, time REAL)`);
});

// Endpoint to submit a score
router.post('/pacmaze/submit_score', (req, res) => {
  const initials = parseInitials(req.body?.initials);
  const time = parseNumber(req.body?.time, { min: 0.01, max: 36000 });

  if (!initials || time === null) {
    return res.status(400).send('Invalid initials or time value');
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
  const initials = parseInitials(req.body?.initials);
  const time = parseNumber(req.body?.time, { min: 0, max: 36000 });

  if (!initials || time === null) {
    return res.status(400).send('Invalid initials or time value');
  }

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