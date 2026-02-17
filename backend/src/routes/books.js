const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/books — list all books with optional filters
router.get('/', (req, res) => {
  const { recommended, genre, source, search, sort = 'date_read', order = 'desc' } = req.query;

  const validSortCols = ['title', 'author_name', 'date_read', 'genre', 'page_count', 'series_order', 'created_at'];
  const sortCol = validSortCols.includes(sort) ? sort : 'date_read';
  const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

  let where = [];
  let params = [];

  if (recommended === '1') { where.push('is_recommended = 1'); }
  if (genre) { where.push('genre = ?'); params.push(genre); }
  if (source) { where.push('source = ?'); params.push(source); }
  if (search) {
    where.push('(title LIKE ? OR author_name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const books = db.prepare(
    `SELECT * FROM books ${whereClause} ORDER BY ${sortCol} ${sortOrder}`
  ).all(...params);

  res.json(books);
});

// GET /api/books/genres — distinct genres for filter dropdown
router.get('/genres', (req, res) => {
  const rows = db.prepare("SELECT DISTINCT genre FROM books WHERE genre IS NOT NULL AND genre != '' ORDER BY genre").all();
  res.json(rows.map(r => r.genre));
});

// GET /api/books/:id
router.get('/:id', (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Not found' });
  res.json(book);
});

// POST /api/books
router.post('/', (req, res) => {
  const {
    title, author_name, author_gender, author_ethnicity, genre,
    page_count, series_name, series_order, date_read, blurb,
    referral_source, is_recommended = 0, source = 'Manual'
  } = req.body;

  if (!title) return res.status(400).json({ error: 'title is required' });

  const result = db.prepare(`
    INSERT INTO books
      (title, author_name, author_gender, author_ethnicity, genre,
       page_count, series_name, series_order, date_read, blurb,
       referral_source, is_recommended, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    title, author_name, author_gender, author_ethnicity, genre,
    page_count, series_name, series_order, date_read, blurb,
    referral_source, is_recommended ? 1 : 0, source
  );

  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(book);
});

// PUT /api/books/:id
router.put('/:id', (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Not found' });

  const {
    title = book.title,
    author_name = book.author_name,
    author_gender = book.author_gender,
    author_ethnicity = book.author_ethnicity,
    genre = book.genre,
    page_count = book.page_count,
    series_name = book.series_name,
    series_order = book.series_order,
    date_read = book.date_read,
    blurb = book.blurb,
    referral_source = book.referral_source,
    is_recommended = book.is_recommended,
    source = book.source
  } = req.body;

  db.prepare(`
    UPDATE books SET
      title = ?, author_name = ?, author_gender = ?, author_ethnicity = ?,
      genre = ?, page_count = ?, series_name = ?, series_order = ?,
      date_read = ?, blurb = ?, referral_source = ?, is_recommended = ?, source = ?
    WHERE id = ?
  `).run(
    title, author_name, author_gender, author_ethnicity,
    genre, page_count, series_name, series_order,
    date_read, blurb, referral_source, is_recommended ? 1 : 0, source,
    req.params.id
  );

  res.json(db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id));
});

// PATCH /api/books/:id/recommend — toggle recommendation flag
router.patch('/:id/recommend', (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Not found' });

  const newVal = book.is_recommended ? 0 : 1;
  db.prepare('UPDATE books SET is_recommended = ? WHERE id = ?').run(newVal, req.params.id);
  res.json({ id: Number(req.params.id), is_recommended: newVal });
});

// DELETE /api/books/:id
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM books WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

// POST /api/books/import — bulk import from extension
router.post('/import', (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.EXTENSION_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { books: incoming, source } = req.body;
  if (!Array.isArray(incoming)) return res.status(400).json({ error: 'books array required' });

  let added = 0, skipped = 0;

  const upsert = db.transaction((books) => {
    for (const b of books) {
      const exists = db.prepare(
        'SELECT id FROM books WHERE lower(title) = lower(?) AND lower(author_name) = lower(?)'
      ).get(b.title || '', b.author_name || '');

      if (exists) { skipped++; continue; }

      db.prepare(`
        INSERT INTO books (title, author_name, genre, page_count, date_read, source)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(b.title, b.author_name, b.genre, b.page_count, b.date_read, source || 'Manual');
      added++;
    }
  });

  upsert(incoming);
  res.json({ added, skipped });
});

module.exports = router;
