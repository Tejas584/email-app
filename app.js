// Load environment variables first
require('dotenv').config();

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const sendEmailsRouter = require('./routes/sendemails');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.get('/', (req, res) => {
  res.render('index', { title: 'Bulk Email Sender' });
});
app.use('/', sendEmailsRouter);

// 404 handler (should be last)
app.use((req, res) => {
  res.status(404).render('404');
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});