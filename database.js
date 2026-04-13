const Database = require('better-sqlite3');
const path = require('path');

const db = new Database('exam_system.db');

// Enable foreign keys
db.pragma('foreign_keys = ON');

/**
 * ========================================
 * DATABASE SCHEMA SETUP
 * ========================================
 */
function initializeDatabase() {
  // Users Table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT,
      email TEXT,
      createdAt TEXT
    )
  `).run();

  // Students Table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      userId TEXT,
      studentName TEXT,
      studentContact TEXT,
      email TEXT,
      createdAt TEXT,
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `).run();

  // Admins Table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      userId TEXT,
      adminName TEXT,
      adminContact TEXT,
      createdAt TEXT,
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `).run();

  // Subjects Table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      subjectCode TEXT UNIQUE,
      subjectName TEXT,
      department TEXT,
      semester TEXT,
      createdAt TEXT
    )
  `).run();

  // Questions Table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      subjectId TEXT,
      text TEXT,
      options TEXT, -- JSON array
      correct INTEGER,
      type TEXT,
      level TEXT,
      createdAt TEXT,
      FOREIGN KEY(subjectId) REFERENCES subjects(id) ON DELETE CASCADE
    )
  `).run();

  // Exams Table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS exams (
      id TEXT PRIMARY KEY,
      subjectId TEXT,
      examName TEXT,
      examDate TEXT,
      examTime TEXT,
      duration INTEGER,
      totalMarks INTEGER,
      passingMarks INTEGER,
      status TEXT,
      instructions TEXT,
      adminId TEXT,
      questionIds TEXT, -- JSON array
      createdAt TEXT,
      FOREIGN KEY(subjectId) REFERENCES subjects(id) ON DELETE CASCADE
    )
  `).run();

  // Registrations Table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS registrations (
      id TEXT PRIMARY KEY,
      studentId TEXT,
      examId TEXT,
      registeredAt TEXT,
      FOREIGN KEY(studentId) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY(examId) REFERENCES exams(id) ON DELETE CASCADE
    )
  `).run();

  // Results Table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS results (
      id TEXT PRIMARY KEY,
      studentId TEXT,
      examId TEXT,
      score INTEGER,
      totalMarks INTEGER,
      percentage INTEGER,
      passed INTEGER, -- Boolean 0/1
      resultName TEXT,
      timeTaken INTEGER,
      answers TEXT, -- JSON object
      resultDate TEXT,
      FOREIGN KEY(studentId) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY(examId) REFERENCES exams(id) ON DELETE CASCADE
    )
  `).run();

  seedData();
}

/**
 * ========================================
 * SEED DATA (Runs if users table is empty)
 * ========================================
 */
function seedData() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount > 0) return;

  console.log('Seeding initial data...');

  const now = new Date().toISOString();

  // Helper to insert and return row
  const insert = (table, data) => {
    const keys = Object.keys(data);
    const cols = keys.join(', ');
    const placeholders = keys.map(() => '?').join(', ');
    const stmt = db.prepare(`INSERT INTO ${table} (${cols}) VALUES (${placeholders})`);
    stmt.run(Object.values(data));
    return data;
  };

  // IDs (Following the same pattern as before)
  const nextId = (prefix, n) => `${prefix}-${1000 + n}`;

  // Admin user
  const adminId = nextId('USR', 1);
  insert('users', { id: adminId, username: 'admin', password: 'admin123', role: 'admin', email: 'admin@exam.edu', createdAt: now });
  insert('admins', { id: nextId('ADM', 1), userId: adminId, adminName: 'System Admin', adminContact: '9876543210', createdAt: now });

  // Student users
  const studData = [
    { username: 'alice', password: 'alice123', name: 'Alice Johnson', contact: '9123456780', email: 'alice@student.edu' },
    { username: 'bob',   password: 'bob123',   name: 'Bob Smith',    contact: '9123456781', email: 'bob@student.edu'   },
    { username: 'carol', password: 'carol123', name: 'Carol Davis',  contact: '9123456782', email: 'carol@student.edu' },
  ];

  const studentIds = [];
  studData.forEach((s, i) => {
    const uId = nextId('USR', i + 2);
    const sId = nextId('STU', i + 1);
    studentIds.push(sId);
    insert('users', { id: uId, username: s.username, password: s.password, role: 'student', email: s.email, createdAt: now });
    insert('students', { id: sId, userId: uId, studentName: s.name, studentContact: s.contact, email: s.email, createdAt: now });
  });

  // Subjects
  const subDBMS = insert('subjects', { id: 'SUB-1001', subjectCode: 'CS301', subjectName: 'Database Management System', department: 'CSE', semester: '5th', createdAt: now });
  const subOS   = insert('subjects', { id: 'SUB-1002', subjectCode: 'CS302', subjectName: 'Operating Systems',           department: 'CSE', semester: '5th', createdAt: now });
  const subCN   = insert('subjects', { id: 'SUB-1003', subjectCode: 'CS303', subjectName: 'Computer Networks',           department: 'CSE', semester: '6th', createdAt: now });

  // Questions
  const dbmsQuestions = [
    { text: 'What does DBMS stand for?', options: ['Database Management System','Data Backup Management System','Data Base Meta System','Distributed Base Management System'], correct: 0, type: 'MCQ', level: 'easy', subjectId: subDBMS.id },
    { text: 'Which of the following is NOT a valid SQL command?', options: ['SELECT','UPDATE','MODIFY','DELETE'], correct: 2, type: 'MCQ', level: 'easy', subjectId: subDBMS.id },
    { text: 'In the ER model, a diamond represents a:', options: ['Entity','Attribute','Relationship','Key'], correct: 2, type: 'MCQ', level: 'medium', subjectId: subDBMS.id },
    { text: 'Which normal form is concerned with multivalued dependencies?', options: ['1NF','2NF','3NF','4NF'], correct: 3, type: 'MCQ', level: 'hard', subjectId: subDBMS.id },
    { text: 'A primary key uniquely identifies a record. This property is called:', options: ['Entity Integrity','Referential Integrity','Domain Integrity','User-Defined Integrity'], correct: 0, type: 'MCQ', level: 'medium', subjectId: subDBMS.id },
    { text: 'The SQL command to remove a table completely is:', options: ['DELETE','DROP','REMOVE','ERASE'], correct: 1, type: 'MCQ', level: 'easy', subjectId: subDBMS.id },
    { text: 'ACID stands for:', options: ['Atomicity, Consistency, Isolation, Durability','Authority, Consistency, Isolation, Data','Atomicity, Concurrency, Isolation, Durability','Authority, Concurrency, Integration, Durability'], correct: 0, type: 'MCQ', level: 'medium', subjectId: subDBMS.id },
    { text: 'Which join returns rows when there is a match in both tables?', options: ['LEFT JOIN','RIGHT JOIN','INNER JOIN','FULL OUTER JOIN'], correct: 2, type: 'MCQ', level: 'medium', subjectId: subDBMS.id },
    { text: 'A foreign key creates a link between:', options: ['Two columns in same table','Two different tables','Two different databases','A table and a view'], correct: 1, type: 'MCQ', level: 'easy', subjectId: subDBMS.id },
    { text: 'Boyce-Codd Normal Form (BCNF) is a stricter version of:', options: ['1NF','2NF','3NF','4NF'], correct: 2, type: 'MCQ', level: 'hard', subjectId: subDBMS.id },
  ];

  const osQuestions = [
    { text: 'Which scheduling algorithm gives the minimum average waiting time?', options: ['FCFS','SJF','Round Robin','Priority'], correct: 1, type: 'MCQ', level: 'medium', subjectId: subOS.id },
    { text: 'What is thrashing?', options: ['Process starvation','Excessive paging activity causing low CPU utilization','A type of deadlock','Cache overflow'], correct: 1, type: 'MCQ', level: 'hard', subjectId: subOS.id },
    { text: 'Deadlock prevention technique that eliminates "Hold and Wait" condition:', options: ['Resource ordering','Pre-emption','Process termination','Requesting all resources at once'], correct: 3, type: 'MCQ', level: 'hard', subjectId: subOS.id },
    { text: 'Paging eliminates which memory allocation problem?', options: ['Swapping','Internal fragmentation','External fragmentation','Thrashing'], correct: 2, type: 'MCQ', level: 'medium', subjectId: subOS.id },
    { text: 'In a multiprogramming OS, the degree of multiprogramming refers to:', options: ['CPU speed','Number of programs in memory','RAM size','Number of I/O devices'], correct: 1, type: 'MCQ', level: 'easy', subjectId: subOS.id },
  ];

  const cnQuestions = [
    { text: 'Which layer of OSI model is responsible for routing?', options: ['Data Link','Network','Transport','Session'], correct: 1, type: 'MCQ', level: 'easy', subjectId: subCN.id },
    { text: 'TCP is a _____ protocol:', options: ['Connectionless','Connection-oriented','Broadcast','Multicast'], correct: 1, type: 'MCQ', level: 'easy', subjectId: subCN.id },
    { text: 'The maximum number of IP addresses in a /24 subnet:', options: ['254','256','255','128'], correct: 1, type: 'MCQ', level: 'medium', subjectId: subCN.id },
    { text: 'Which protocol resolves IP addresses to MAC addresses?', options: ['DNS','DHCP','ARP','ICMP'], correct: 2, type: 'MCQ', level: 'medium', subjectId: subCN.id },
    { text: 'HTTP default port number:', options: ['21','22','80','443'], correct: 2, type: 'MCQ', level: 'easy', subjectId: subCN.id },
  ];

  const allQuestions = [...dbmsQuestions, ...osQuestions, ...cnQuestions];
  const qIds = [];
  allQuestions.forEach((q, i) => {
    const id = nextId('QUE', i + 1);
    qIds.push(id);
    insert('questions', {
      id,
      subjectId: q.subjectId,
      text: q.text,
      options: JSON.stringify(q.options),
      correct: q.correct,
      type: q.type,
      level: q.level,
      createdAt: now
    });
  });

  // Exams
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);

  const examDBMS = insert('exams', {
    id: 'EXM-1001',
    examName: 'DBMS Mid-Term Examination',
    subjectId: subDBMS.id,
    examDate: tomorrow.toISOString().split('T')[0],
    examTime: '10:00',
    duration: 30,
    totalMarks: 10,
    passingMarks: 6,
    questionIds: JSON.stringify(qIds.slice(0, 10)),
    status: 'active',
    adminId: adminId,
    instructions: 'Read all questions carefully. Each question carries 1 mark. No negative marking.',
    createdAt: now
  });

  const examOS = insert('exams', {
    id: 'EXM-1002',
    examName: 'Operating Systems Unit Test',
    subjectId: subOS.id,
    examDate: tomorrow.toISOString().split('T')[0],
    examTime: '14:00',
    duration: 20,
    totalMarks: 5,
    passingMarks: 3,
    questionIds: JSON.stringify(qIds.slice(10, 15)),
    status: 'active',
    adminId: adminId,
    instructions: 'All questions are compulsory. Each question carries 1 mark.',
    createdAt: now
  });

  const examCN = insert('exams', {
    id: 'EXM-1003',
    examName: 'Computer Networks Quiz',
    subjectId: subCN.id,
    examDate: yesterday.toISOString().split('T')[0],
    examTime: '09:00',
    duration: 15,
    totalMarks: 5,
    passingMarks: 3,
    questionIds: JSON.stringify(qIds.slice(15, 20)),
    status: 'completed',
    adminId: adminId,
    instructions: 'Quick quiz. Each correct answer = 1 mark.',
    createdAt: now
  });

  // Registrations
  studentIds.forEach((sId, i) => {
    insert('registrations', { id: `REG-${1001 + (i*3)}`, studentId: sId, examId: examDBMS.id, registeredAt: now });
    insert('registrations', { id: `REG-${1002 + (i*3)}`, studentId: sId, examId: examOS.id,   registeredAt: now });
    insert('registrations', { id: `REG-${1003 + (i*3)}`, studentId: sId, examId: examCN.id,   registeredAt: now });
  });

  // Sample results for CN (completed exam)
  const scores = [4, 3, 5];
  studentIds.forEach((sId, idx) => {
    const score = scores[idx];
    insert('results', {
      id: `RES-${1001 + idx}`,
      studentId: sId,
      examId: examCN.id,
      score,
      totalMarks: 5,
      percentage: Math.round((score / 5) * 100),
      passed: score >= 3 ? 1 : 0,
      resultName: `Result for Exam CN`,
      timeTaken: Math.floor(Math.random() * 10) + 5,
      answers: '{}',
      resultDate: now
    });
  });

  console.log('Database seeded successfully.');
}

initializeDatabase();

module.exports = db;
