const express = require('express');
const db = require('../common/db');

const router = express.Router();

// Create a table for the leaderboard
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS dogrun_leaderboard (initials TEXT, bones INTEGER)`);
});

// Endpoint to submit a score
router.post('/dogrun/submit_score', (req, res) => {
  const { initials, bones } = req.body;
  const stmt = db.prepare('INSERT INTO dogrun_leaderboard (initials, bones) VALUES (?, ?)');
  stmt.run(initials, bones, function(err) {
    if (err) {
      res.status(500).send('Database error');
    } else {
      res.sendStatus(200);
    }
  });
  stmt.finalize();
});

// Endpoint to get the leaderboard
router.get('/dogrun/get_leaderboard', (req, res) => {
  db.all(`
    SELECT initials, MAX(bones) as bones 
    FROM dogrun_leaderboard 
    GROUP BY initials 
    ORDER BY bones DESC 
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
router.post('/dogrun/delete_score', (req, res) => {
  const { initials, bones } = req.body;

  // Corrected SQL syntax for DELETE query
  const stmt = db.prepare('DELETE FROM dogrun_leaderboard WHERE initials = ? AND bones = ?');

  // Executing the statement with provided parameters
  stmt.run(initials, bones, function(err) {
    if (err) {
      res.status(500).send('Database error');
    } else {
      res.status(200).send({ deletedRows: this.changes });
    }
  });
});

module.exports = router;