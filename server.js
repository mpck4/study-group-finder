process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";  // <-- disables TLS rejection of self-signed certificates
require('dotenv').config();
console.log('POSTGRES_URL:', process.env.POSTGRES_URL);
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

// Create a new Postgres pool using the POSTGRES_URL environment variable
const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: {
        rejectUnauthorized: false // required for Supabase
    }
});

// Create tables if they don't exist (using Postgres SQL)
const createPostsTableQuery = `
  CREATE TABLE IF NOT EXISTS posts (
    id SERIAL PRIMARY KEY,
    title TEXT,
    content TEXT
  );
`;

const createRepliesTableQuery = `
  CREATE TABLE IF NOT EXISTS replies (
    id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    content TEXT
  );
`;

pool.query(createPostsTableQuery)
  .then(() => console.log('Posts table is ready'))
  .catch(err => console.error('Error creating posts table:', err));

pool.query(createRepliesTableQuery)
  .then(() => console.log('Replies table is ready'))
  .catch(err => console.error('Error creating replies table:', err));

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());

// Route to get all posts with their replies
app.get('/api/posts', async (req, res) => {
    const searchTerm = req.query.search || '';
    try {
        let postsQuery;
        let params = [];
        if (searchTerm) {
            postsQuery = 'SELECT * FROM posts WHERE title ILIKE $1';
            params = [`%${searchTerm}%`];
        } else {
            postsQuery = 'SELECT * FROM posts';
        }
        const postsResult = await pool.query(postsQuery, params);
        const posts = postsResult.rows;

        if (posts.length === 0) return res.json([]);

        // For each post, get its replies
        for (let post of posts) {
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
    const { title, content } = req.body;
    console.log('Incoming post:', { title, content });
    try {
        const result = await pool.query(
            'INSERT INTO posts (title, content) VALUES ($1, $2) RETURNING id, title, content',
            [title, content]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route to create a reply
app.post('/api/posts/:id/replies', async (req, res) => {
    const postId = req.params.id;
    const { content } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO replies (post_id, content) VALUES ($1, $2) RETURNING id, content',
            [postId, content]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route to delete all posts (and their replies)
app.delete('/api/posts', async (req, res) => {
    try {
        // Delete replies first, then posts
        await pool.query('DELETE FROM replies');
        await pool.query('DELETE FROM posts');
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/*
  little note:
  curl -X DELETE http://localhost:3000/api/posts
  to delete all posts from the server.
*/

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});


