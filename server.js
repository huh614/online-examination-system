const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Serve static files
app.use(express.static(__dirname));

// --- Helper for ID generation ---
const getNextId = (table, prefix) => {
  const row = db.prepare(`SELECT id FROM ${table} WHERE id LIKE ? ORDER BY id DESC LIMIT 1`).get(`${prefix}-%`);
  if (!row) return `${prefix}-1001`;
  const num = parseInt(row.id.split('-')[1]);
  return `${prefix}-${num + 1}`;
};

// =============================================
// AUTH ROUTES
// =============================================

app.post('/api/login', (req, res) => {
  const { username, password, role } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ? AND role = ?').get(username, password, role);
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials or role' });
  }

  let profile;
  if (role === 'admin') {
    profile = db.prepare('SELECT * FROM admins WHERE userId = ?').get(user.id);
  } else {
    profile = db.prepare('SELECT * FROM students WHERE userId = ?').get(user.id);
  }

  res.json({ user, profile });
});

app.post('/api/register', (req, res) => {
  const { username, password, role, email, fullname, contact } = req.body;
  
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(400).json({ error: 'Username already taken' });
  }

  const userId = getNextId('users', 'USR');
  const createdAt = new Date().toISOString();

  const transaction = db.transaction(() => {
    db.prepare('INSERT INTO users (id, username, password, role, email, createdAt) VALUES (?, ?, ?, ?, ?, ?)')
      .run(userId, username, password, role, email, createdAt);

    let profile;
    if (role === 'admin') {
      const adminId = getNextId('admins', 'ADM');
      profile = { id: adminId, userId, adminName: fullname, adminContact: contact, createdAt };
      db.prepare('INSERT INTO admins (id, userId, adminName, adminContact, createdAt) VALUES (?, ?, ?, ?, ?)')
        .run(adminId, userId, fullname, contact, createdAt);
    } else {
      const studentId = getNextId('students', 'STU');
      profile = { id: studentId, userId, studentName: fullname, studentContact: contact, email, createdAt };
      db.prepare('INSERT INTO students (id, userId, studentName, studentContact, email, createdAt) VALUES (?, ?, ?, ?, ?, ?)')
        .run(studentId, userId, fullname, contact, email, createdAt);
    }
    return profile;
  });

  try {
    const profile = transaction();
    res.json({ user: { id: userId, username, role, email }, profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users', (req, res) => {
  const users = db.prepare('SELECT id, username, role, email, createdAt FROM users').all();
  res.json(users);
});

app.get('/api/users/:id', (req, res) => {
  const user = db.prepare('SELECT id, username, role, email, createdAt FROM users WHERE id = ?').get(req.params.id);
  res.json(user);
});

// =============================================
// ADMIN ROUTES
// =============================================

app.get('/api/admins', (req, res) => {
  const admins = db.prepare('SELECT * FROM admins').all();
  res.json(admins);
});

app.get('/api/admins/:id', (req, res) => {
  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.params.id);
  res.json(admin);
});

// =============================================
// STUDENT ROUTES
// =============================================

app.get('/api/students', (req, res) => {
  const students = db.prepare('SELECT * FROM students').all();
  res.json(students);
});

app.get('/api/students/:id', (req, res) => {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  res.json(student);
});

app.put('/api/students/:id', (req, res) => {
  const { studentName, studentContact, email } = req.body;
  db.prepare('UPDATE students SET studentName = ?, studentContact = ?, email = ? WHERE id = ?')
    .run(studentName, studentContact, email, req.params.id);
  res.json({ success: true });
});

app.delete('/api/students/:id', (req, res) => {
  db.prepare('DELETE FROM students WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// =============================================
// SUBJECT ROUTES
// =============================================

app.get('/api/subjects', (req, res) => {
  const subjects = db.prepare('SELECT * FROM subjects').all();
  res.json(subjects);
});

app.get('/api/subjects/:id', (req, res) => {
  const subject = db.prepare('SELECT * FROM subjects WHERE id = ?').get(req.params.id);
  res.json(subject);
});

app.post('/api/subjects', (req, res) => {
  const id = getNextId('subjects', 'SUB');
  const { subjectCode, subjectName, department, semester } = req.body;
  db.prepare('INSERT INTO subjects (id, subjectCode, subjectName, department, semester, createdAt) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, subjectCode, subjectName, department, semester, new Date().toISOString());
  res.json({ id });
});

app.put('/api/subjects/:id', (req, res) => {
  const { subjectCode, subjectName, department, semester } = req.body;
  db.prepare('UPDATE subjects SET subjectCode = ?, subjectName = ?, department = ?, semester = ? WHERE id = ?')
    .run(subjectCode, subjectName, department, semester, req.params.id);
  res.json({ success: true });
});

app.delete('/api/subjects/:id', (req, res) => {
  db.prepare('DELETE FROM subjects WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// =============================================
// QUESTION ROUTES
// =============================================

app.get('/api/questions', (req, res) => {
  const questions = db.prepare('SELECT * FROM questions').all().map(q => ({
    ...q,
    options: JSON.parse(q.options)
  }));
  res.json(questions);
});

app.get('/api/questions/:id', (req, res) => {
  const q = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id);
  if (q) q.options = JSON.parse(q.options);
  res.json(q);
});

app.post('/api/questions', (req, res) => {
  const id = getNextId('questions', 'QUE');
  const { subjectId, text, options, correct, type, level } = req.body;
  db.prepare('INSERT INTO questions (id, subjectId, text, options, correct, type, level, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, subjectId, text, JSON.stringify(options), correct, type, level, new Date().toISOString());
  res.json({ id });
});

app.put('/api/questions/:id', (req, res) => {
  const { subjectId, text, options, correct, type, level } = req.body;
  db.prepare('UPDATE questions SET subjectId = ?, text = ?, options = ?, correct = ?, type = ?, level = ? WHERE id = ?')
    .run(subjectId, text, JSON.stringify(options), correct, type, level, req.params.id);
  res.json({ success: true });
});

app.delete('/api/questions/:id', (req, res) => {
  db.prepare('DELETE FROM questions WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// =============================================
// EXAM ROUTES
// =============================================

app.get('/api/exams', (req, res) => {
  const exams = db.prepare('SELECT * FROM exams').all().map(e => ({
    ...e,
    questionIds: JSON.parse(e.questionIds)
  }));
  res.json(exams);
});

app.get('/api/exams/:id', (req, res) => {
  const e = db.prepare('SELECT * FROM exams WHERE id = ?').get(req.params.id);
  if (e) e.questionIds = JSON.parse(e.questionIds);
  res.json(e);
});

app.post('/api/exams', (req, res) => {
  const id = getNextId('exams', 'EXM');
  const { subjectId, examName, examDate, examTime, duration, totalMarks, passingMarks, status, instructions, adminId, questionIds } = req.body;
  db.prepare('INSERT INTO exams (id, subjectId, examName, examDate, examTime, duration, totalMarks, passingMarks, status, instructions, adminId, questionIds, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, subjectId, examName, examDate, examTime, duration, totalMarks, passingMarks, status, instructions, adminId, JSON.stringify(questionIds), new Date().toISOString());
  res.json({ id });
});

app.put('/api/exams/:id', (req, res) => {
  const { subjectId, examName, examDate, examTime, duration, status } = req.body;
  db.prepare('UPDATE exams SET subjectId = ?, examName = ?, examDate = ?, examTime = ?, duration = ?, status = ? WHERE id = ?')
    .run(subjectId, examName, examDate, examTime, duration, status, req.params.id);
  res.json({ success: true });
});

app.delete('/api/exams/:id', (req, res) => {
  db.prepare('DELETE FROM exams WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// =============================================
// REGISTRATION ROUTES
// =============================================

app.get('/api/registrations', (req, res) => {
  const regs = db.prepare('SELECT * FROM registrations').all();
  res.json(regs);
});

app.post('/api/registrations', (req, res) => {
  const id = getNextId('registrations', 'REG');
  const { studentId, examId } = req.body;
  db.prepare('INSERT INTO registrations (id, studentId, examId, registeredAt) VALUES (?, ?, ?, ?)')
    .run(id, studentId, examId, new Date().toISOString());
  res.json({ id });
});

// =============================================
// RESULT ROUTES
// =============================================

app.get('/api/results', (req, res) => {
  const results = db.prepare('SELECT * FROM results').all().map(r => ({
    ...r,
    answers: JSON.parse(r.answers)
  }));
  res.json(results);
});

app.get('/api/results/:id', (req, res) => {
  const r = db.prepare('SELECT * FROM results WHERE id = ?').get(req.params.id);
  if (r) r.answers = JSON.parse(r.answers);
  res.json(r);
});

app.post('/api/results', (req, res) => {
  const id = getNextId('results', 'RES');
  const { studentId, examId, score, totalMarks, percentage, passed, resultName, timeTaken, answers } = req.body;
  db.prepare('INSERT INTO results (id, studentId, examId, score, totalMarks, percentage, passed, resultName, timeTaken, answers, resultDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, studentId, examId, score, totalMarks, percentage, passed ? 1 : 0, resultName, timeTaken, JSON.stringify(answers), new Date().toISOString());
  res.json({ id });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
