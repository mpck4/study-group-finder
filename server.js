require('dns').setDefaultResultOrder('ipv4first');
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
require('dotenv').config(); // Load environment variables from .env file

console.log('Database URL:', process.env.DATABASE_URL); // Verify the DATABASE_URL

const app = express();
const port = process.env.PORT || 3000;

// Set up PostgreSQL database
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        require: true,
        rejectUnauthorized: false, // Keep false for Supabase
    }
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());

// Create tables if they don’t exist
pool.query(`CREATE TABLE IF NOT EXISTS posts (
    id SERIAL PRIMARY KEY,
    content TEXT
)`);

pool.query(`CREATE TABLE IF NOT EXISTS replies (
    id SERIAL PRIMARY KEY,
    post_id INTEGER,
    content TEXT,
    FOREIGN KEY(post_id) REFERENCES posts(id)
)`);

// Route to get all posts with their replies
app.get('/api/posts', async (req, res) => {
    try {
        const postsResult = await pool.query('SELECT * FROM posts');
        const posts = postsResult.rows;

        for (const post of posts) {
            const repliesResult = await pool.query('SELECT * FROM replies WHERE post_id = $1', [post.id]);
            post.replies = repliesResult.rows;
        }

        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route to create a new post
app.post('/api/posts', async (req, res) => {
    const content = req.body.content;
    try {
        const result = await pool.query('INSERT INTO posts (content) VALUES ($1) RETURNING *', [content]);
        const newPost = result.rows[0];
        newPost.replies = [];
        res.status(201).json(newPost);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route to create a reply
app.post('/api/posts/:id/replies', async (req, res) => {
    const postId = req.params.id;
    const content = req.body.content;
    try {
        const result = await pool.query('INSERT INTO replies (post_id, content) VALUES ($1, $2) RETURNING *', [postId, content]);
        const newReply = result.rows[0];
        res.status(201).json(newReply);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route to delete all posts
app.delete('/api/posts', async (req, res) => {
    try {
        await pool.query('DELETE FROM replies');
        await pool.query('DELETE FROM posts');
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
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
