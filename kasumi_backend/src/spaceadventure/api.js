const express = require('express');
const db = require('../common/db');

const router = express.Router();

// Create a table for the leaderboard
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS spaceadventure_leaderboard (initials TEXT, points INTEGER)`);
});

// Endpoint to submit a score
router.post('/spaceadventure/submit_score', (req, res) => {
  const { initials, points } = req.body;
  const stmt = db.prepare('INSERT INTO spaceadventure_leaderboard (initials, points) VALUES (?, ?)');
  stmt.run(initials, points, function(err) {
    if (err) {
      res.status(500).send('Database error');
    } else {
      res.sendStatus(200);
    }
  });
});

// Endpoint to get the leaderboard
router.get('/spaceadventure/get_leaderboard', (req, res) => {
  db.all('SELECT * FROM spaceadventure_leaderboard ORDER BY points DESC LIMIT 10', [], (err, rows) => {
    if (err) {
      res.status(500).send('Database error');
    } else {
      res.json(rows);
    }
  });
});

// Endpoint to clear initials with certain scores from leaderboard
router.post('/spaceadventure/delete_score', (req, res) => {
  const { initials, points } = req.body;

  // Corrected SQL syntax for DELETE query
  const stmt = db.prepare('DELETE FROM spaceadventure_leaderboard WHERE initials = ? AND points = ?');

  // Executing the statement with provided parameters
  stmt.run(initials, points, function(err) {
    if (err) {
      res.status(500).send('Database error');
    } else {
      res.status(200).send({ deletedRows: this.changes });
    }
  });
});


module.exports = router;