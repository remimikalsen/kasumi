const db = require('./db');

// One-off data changes that must run exactly once per database, such as wiping a leaderboard
// for a particular release. Each applied migration is recorded by id, so later deployments
// (and restarts) skip it and keep whatever has been stored since.
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)`);
});

function runOnce(id, sql) {
  db.serialize(() => {
    db.get('SELECT id FROM migrations WHERE id = ?', [id], (err, row) => {
      if (err) {
        console.error(`Could not check migration "${id}"`, err);
        return;
      }
      if (row) return;
      db.serialize(() => {
        db.run(sql, function(runErr) {
          if (runErr) {
            console.error(`Migration "${id}" failed`, runErr);
            return;
          }
          db.run('INSERT INTO migrations (id, applied_at) VALUES (?, ?)', [id, new Date().toISOString()], (insertErr) => {
            if (insertErr) {
              console.error(`Could not record migration "${id}"`, insertErr);
            } else {
              console.log(`Applied migration "${id}" (${this.changes} rows affected)`);
            }
          });
        });
      });
    });
  });
}

module.exports = { runOnce };
