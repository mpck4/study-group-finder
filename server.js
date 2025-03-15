const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const port = process.env.PORT || 3000;

// Set up SQLite database
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) console.error('Database connection error:', err);
    else console.log('Connected to SQLite database');
});

// Create tables if they don’t exist
db.run(`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT
)`);

db.run(`CREATE TABLE IF NOT EXISTS replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER,
    content TEXT,
    FOREIGN KEY(post_id) REFERENCES posts(id)
)`);

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());

// Route to get all posts with their replies
app.get('/api/posts', (req, res) => {
    db.all(`SELECT * FROM posts`, (err, posts) => {
        if (err) return res.status(500).json({ error: err.message });

        let completed = 0;
        posts.forEach((post, index) => {
            db.all(`SELECT * FROM replies WHERE post_id = ?`, [post.id], (err, replies) => {
                posts[index].replies = replies || [];
                completed++;
                if (completed === posts.length) res.json(posts);
            });
        });

        if (posts.length === 0) res.json([]); // Edge case: no posts exist
    });
});

// Route to create a new post
app.post('/api/posts', (req, res) => {
    const content = req.body.content;
    db.run(`INSERT INTO posts (content) VALUES (?)`, [content], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: this.lastID, content, replies: [] });
    });
});

// Route to create a reply
app.post('/api/posts/:id/replies', (req, res) => {
    const postId = req.params.id;
    const content = req.body.content;
    db.run(`INSERT INTO replies (post_id, content) VALUES (?, ?)`, [postId, content], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: this.lastID, content });
    });
});

// Route to delete all posts
app.delete('/api/posts', (req, res) => {
    db.run(`DELETE FROM replies`);
    db.run(`DELETE FROM posts`);
    res.status(204).send();
});

///////////////////////////////////////////////////////////////
///                                                         ///
///    little note:                                         ///
///    curl -X DELETE http://localhost:3000/api/posts       ///
///    to delete all posts from the server.                 ///
///                                                         ///
///////////////////////////////////////////////////////////////

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
