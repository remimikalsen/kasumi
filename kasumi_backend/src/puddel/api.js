const express = require('express');
const db = require('../common/db');
const { parseInitials, parseNumber } = require('../common/validate');

const router = express.Router();

// Leaderboard for "Fang Nelly" (puddel): fastest time to catch Nelly, in seconds
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS puddel_leaderboard (initials TEXT, time REAL)`);
});

// Endpoint to submit a score
router.post('/puddel/submit_score', (req, res) => {
  const initials = parseInitials(req.body?.initials);
  const time = parseNumber(req.body?.time, { min: 0.01, max: 36000 });

  if (!initials || time === null) {
    return res.status(400).send('Invalid initials or time value');
  }

  const stmt = db.prepare('INSERT INTO puddel_leaderboard (initials, time) VALUES (?, ?)');
  stmt.run(initials, Math.round(time * 100) / 100, function(err) {
    if (err) {
      res.status(500).send('Database error');
    } else {
      res.sendStatus(200);
    }
  });
  stmt.finalize();
});

// Endpoint to get the leaderboard: the ten fastest catches, a player may appear more than once
router.get('/puddel/get_leaderboard', (req, res) => {
  db.all(`
    SELECT initials, time
    FROM puddel_leaderboard
    ORDER BY time ASC, rowid ASC
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
router.post('/puddel/delete_score', (req, res) => {
  const initials = parseInitials(req.body?.initials);
  const time = parseNumber(req.body?.time, { min: 0, max: 36000 });

  if (!initials || time === null) {
    return res.status(400).send('Invalid initials or time value');
  }

  const stmt = db.prepare('DELETE FROM puddel_leaderboard WHERE initials = ? AND ROUND(time, 2) = ?');
  stmt.run(initials, Math.round(time * 100) / 100, function(err) {
    if (err) {
      res.status(500).send('Database error');
    } else {
      res.status(200).send({ deletedRows: this.changes });
    }
  });
  stmt.finalize();
});

module.exports = router;
