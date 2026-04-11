/**
 * ========================================
 * ONLINE EXAMINATION SYSTEM - DATABASE
 * ========================================
 * LocalStorage-based relational DB engine
 * Mirrors the ER diagram entities:
 *   Student, Admin, Subject, Question,
 *   Exam, Result (with relationships)
 * ========================================
 */

const DB = (() => {

  // --- Core Storage ---
  const store = (key, data) => localStorage.setItem(`OES_${key}`, JSON.stringify(data));
  const load  = (key)       => JSON.parse(localStorage.getItem(`OES_${key}`) || 'null');

  // --- ID Generator ---
  let _seqCache = {};
  const nextId = (prefix) => {
    const key = `seq_${prefix}`;
    let n = load(key) || 1000;
    n++;
    store(key, n);
    return `${prefix}-${n}`;
  };

  // --- Table helpers ---
  const getTable  = (t)       => load(t) || [];
  const saveTable = (t, rows) => store(t, rows);

  const insert = (table, row) => {
    const rows = getTable(table);
    rows.push(row);
    saveTable(table, rows);
    return row;
  };

  const update = (table, id, fields) => {
    const rows = getTable(table);
    const idx  = rows.findIndex(r => r.id === id);
    if (idx === -1) return null;
    rows[idx] = { ...rows[idx], ...fields };
    saveTable(table, rows);
    return rows[idx];
  };

  const remove = (table, id) => {
    let rows = getTable(table);
    const len = rows.length;
    rows = rows.filter(r => r.id !== id);
    saveTable(table, rows);
    return rows.length < len;
  };

  const findAll  = (table, pred)       => getTable(table).filter(pred || (() => true));
  const findOne  = (table, pred)       => getTable(table).find(pred);
  const findById = (table, id)         => findOne(table, r => r.id === id);

  // =============================================
  // TABLES (match ER diagram)
  // =============================================

  // ---------- USERS (shared auth table) ----------
  const Users = {
    create: (data) => insert('users', { id: nextId('USR'), createdAt: new Date().toISOString(), ...data }),
    findByUsernameAndRole: (username, role) => findOne('users', u => u.username === username && u.role === role),
    findById: (id) => findById('users', id),
    getAll: () => getTable('users'),
  };

  // ---------- STUDENTS ----------
  const Students = {
    create: (data) => insert('students', { id: nextId('STU'), createdAt: new Date().toISOString(), ...data }),
    update: (id, data) => update('students', id, data),
    delete: (id) => { remove('students', id); },
    findByUserId: (userId) => findOne('students', s => s.userId === userId),
    getAll: () => getTable('students'),
    findById: (id) => findById('students', id),
    count: () => getTable('students').length,
  };

  // ---------- ADMINS ----------
  const Admins = {
    create: (data) => insert('admins', { id: nextId('ADM'), createdAt: new Date().toISOString(), ...data }),
    findByUserId: (userId) => findOne('admins', a => a.userId === userId),
    getAll: () => getTable('admins'),
    findById: (id) => findById('admins', id),
  };

  // ---------- SUBJECTS ----------
  const Subjects = {
    create: (data) => insert('subjects', { id: nextId('SUB'), createdAt: new Date().toISOString(), ...data }),
    update: (id, data) => update('subjects', id, data),
    delete: (id) => { remove('subjects', id); },
    getAll: () => getTable('subjects'),
    findById: (id) => findById('subjects', id),
    findByCode: (code) => findOne('subjects', s => s.subjectCode === code),
    count: () => getTable('subjects').length,
  };

  // ---------- QUESTIONS ----------
  const Questions = {
    create: (data) => insert('questions', { id: nextId('QUE'), createdAt: new Date().toISOString(), ...data }),
    update: (id, data) => update('questions', id, data),
    delete: (id) => { remove('questions', id); },
    getAll: () => getTable('questions'),
    findById: (id) => findById('questions', id),
    findBySubject: (subjectId) => findAll('questions', q => q.subjectId === subjectId),
    count: () => getTable('questions').length,
  };

  // ---------- EXAMS ----------
  const Exams = {
    create: (data) => insert('exams', {
      id: nextId('EXM'),
      createdAt: new Date().toISOString(),
      status: 'upcoming',
      ...data
    }),
    update: (id, data) => update('exams', id, data),
    delete: (id) => { remove('exams', id); },
    getAll: () => getTable('exams'),
    findById: (id) => findById('exams', id),
    findBySubject: (subjectId) => findAll('exams', e => e.subjectId === subjectId),
    findActive: () => findAll('exams', e => e.status === 'active'),
    count: () => getTable('exams').length,
    getUpcoming: () => findAll('exams', e => e.status === 'upcoming' || e.status === 'active'),
  };

  // ---------- REGISTRATIONS (registers_for) ----------
  const Registrations = {
    create: (data) => insert('registrations', { id: nextId('REG'), createdAt: new Date().toISOString(), ...data }),
    delete: (id) => remove('registrations', id),
    findByStudent: (studentId) => findAll('registrations', r => r.studentId === studentId),
    findByExam: (examId) => findAll('registrations', r => r.examId === examId),
    findByStudentAndExam: (studentId, examId) => findOne('registrations', r => r.studentId === studentId && r.examId === examId),
    getAll: () => getTable('registrations'),
    count: () => getTable('registrations').length,
  };

  // ---------- RESULTS (generates relationships) ----------
  const Results = {
    create: (data) => insert('results', { id: nextId('RES'), resultDate: new Date().toISOString(), ...data }),
    update: (id, data) => update('results', id, data),
    getAll: () => getTable('results'),
    findById: (id) => findById('results', id),
    findByStudent: (studentId) => findAll('results', r => r.studentId === studentId),
    findByExam: (examId) => findAll('results', r => r.examId === examId),
    findByStudentAndExam: (studentId, examId) => findOne('results', r => r.studentId === studentId && r.examId === examId),
    count: () => getTable('results').length,
    avgScore: () => {
      const rs = getTable('results');
      if (!rs.length) return 0;
      return Math.round(rs.reduce((a, r) => a + (r.percentage || 0), 0) / rs.length);
    },
  };

  // =============================================
  // SEED DATA (runs once)
  // =============================================
  const seed = () => {
    if (load('seeded')) return;

    // Admin user
    const adminUser = Users.create({ username: 'admin', password: 'admin123', role: 'admin', email: 'admin@exam.edu' });
    Admins.create({ userId: adminUser.id, adminName: 'System Admin', adminContact: '9876543210' });

    // Student users
    const studUsers = [
      { username: 'alice', password: 'alice123', name: 'Alice Johnson', contact: '9123456780', email: 'alice@student.edu' },
      { username: 'bob',   password: 'bob123',   name: 'Bob Smith',    contact: '9123456781', email: 'bob@student.edu'   },
      { username: 'carol', password: 'carol123', name: 'Carol Davis',  contact: '9123456782', email: 'carol@student.edu' },
    ];

    for (const s of studUsers) {
      const u = Users.create({ username: s.username, password: s.password, role: 'student', email: s.email });
      Students.create({ userId: u.id, studentName: s.name, studentContact: s.contact, email: s.email });
    }

    // Subjects
    const subDBMS = Subjects.create({ subjectCode: 'CS301', subjectName: 'Database Management System', department: 'CSE', semester: '5th' });
    const subOS   = Subjects.create({ subjectCode: 'CS302', subjectName: 'Operating Systems',           department: 'CSE', semester: '5th' });
    const subCN   = Subjects.create({ subjectCode: 'CS303', subjectName: 'Computer Networks',           department: 'CSE', semester: '6th' });

    // Questions - DBMS
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

    [...dbmsQuestions, ...osQuestions, ...cnQuestions].forEach(q => Questions.create(q));

    // Exams
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);

    const examDBMS = Exams.create({
      examName: 'DBMS Mid-Term Examination',
      subjectId: subDBMS.id,
      examDate: tomorrow.toISOString().split('T')[0],
      examTime: '10:00',
      duration: 30,
      totalMarks: 10,
      passingMarks: 6,
      questionIds: dbmsQuestions.map((_, i) => `QUE-${1001 + i}`),
      status: 'active',
      adminId: adminUser.id,
      instructions: 'Read all questions carefully. Each question carries 1 mark. No negative marking.',
    });

    const examOS = Exams.create({
      examName: 'Operating Systems Unit Test',
      subjectId: subOS.id,
      examDate: tomorrow.toISOString().split('T')[0],
      examTime: '14:00',
      duration: 20,
      totalMarks: 5,
      passingMarks: 3,
      questionIds: osQuestions.map((_, i) => `QUE-${1011 + i}`),
      status: 'active',
      adminId: adminUser.id,
      instructions: 'All questions are compulsory. Each question carries 1 mark.',
    });

    const examCN = Exams.create({
      examName: 'Computer Networks Quiz',
      subjectId: subCN.id,
      examDate: yesterday.toISOString().split('T')[0],
      examTime: '09:00',
      duration: 15,
      totalMarks: 5,
      passingMarks: 3,
      questionIds: cnQuestions.map((_, i) => `QUE-${1016 + i}`),
      status: 'completed',
      adminId: adminUser.id,
      instructions: 'Quick quiz. Each correct answer = 1 mark.',
    });

    // Register students for exams
    const allStudents = Students.getAll();
    allStudents.forEach(s => {
      Registrations.create({ studentId: s.id, examId: examDBMS.id, registeredAt: new Date().toISOString() });
      Registrations.create({ studentId: s.id, examId: examOS.id,   registeredAt: new Date().toISOString() });
      Registrations.create({ studentId: s.id, examId: examCN.id,   registeredAt: new Date().toISOString() });
    });

    // Sample results for CN (completed exam)
    const cnQIds = cnQuestions.map((_, i) => `QUE-${1016 + i}`);
    const scores = [4, 3, 5];
    allStudents.forEach((s, idx) => {
      const score = scores[idx];
      Results.create({
        studentId: s.id,
        examId: examCN.id,
        score,
        totalMarks: 5,
        percentage: Math.round((score / 5) * 100),
        passed: score >= 3,
        resultName: `${s.studentName} - Computer Networks Quiz Result`,
        timeTaken: Math.floor(Math.random() * 10) + 5,
        answers: {},
      });
    });

    store('seeded', true);
  };

  // =============================================
  // SESSION MANAGEMENT
  // =============================================
  const Session = {
    set: (user, profile) => {
      sessionStorage.setItem('OES_session', JSON.stringify({ user, profile, loginAt: new Date().toISOString() }));
    },
    get: () => {
      const s = sessionStorage.getItem('OES_session');
      return s ? JSON.parse(s) : null;
    },
    clear: () => sessionStorage.removeItem('OES_session'),
    isLoggedIn: () => !!sessionStorage.getItem('OES_session'),
  };

  return {
    Users, Students, Admins, Subjects, Questions,
    Exams, Registrations, Results, Session, seed,
  };
})();
