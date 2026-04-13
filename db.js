/**
 * ========================================
 * ONLINE EXAMINATION SYSTEM - API SERVICE
 * ========================================
 * Frontend service that communicates with
 * the Node.js/Express backend.
 * ========================================
 */

const DB = (() => {
  const API_URL = 'http://localhost:5000/api';

  const request = async (path, method = 'GET', body = null) => {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) options.body = JSON.stringify(body);
    
    try {
      const res = await fetch(`${API_URL}${path}`, options);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Request failed');
      }
      return await res.json();
    } catch (err) {
      console.error(`API Error (${path}):`, err);
      throw err;
    }
  };

  // ---------- USERS ----------
  const Users = {
    create: (data) => request('/register', 'POST', { ...data, fullname: data.username }), // Adjust as needed
    findByUsernameAndRole: async (username, role) => {
      // Typically login is used here
      return null; // Not directly used in app.js for lookup anymore, handled via login
    },
    login: (username, password, role) => request('/login', 'POST', { username, password, role }),
    findById: (id) => request(`/users/${id}`),
    getAll: () => request('/users'),
  };

  // ---------- STUDENTS ----------
  const Students = {
    create: (data) => request('/register', 'POST', { ...data, role: 'student' }),
    update: (id, data) => request(`/students/${id}`, 'PUT', data),
    delete: (id) => request(`/students/${id}`, 'DELETE'),
    findByUserId: async (userId) => {
      const all = await request('/students');
      return all.find(s => s.userId === userId);
    },
    getAll: () => request('/students'),
    findById: (id) => request(`/students/${id}`),
    count: async () => (await request('/students')).length,
  };

  // ---------- ADMINS ----------
  const Admins = {
    create: (data) => request('/register', 'POST', { ...data, role: 'admin' }),
    findByUserId: async (userId) => {
      const all = await request('/admins');
      return all.find(a => a.userId === userId);
    },
    getAll: () => request('/admins'),
    findById: (id) => request(`/admins/${id}`),
  };

  // ---------- SUBJECTS ----------
  const Subjects = {
    create: (data) => request('/subjects', 'POST', data),
    update: (id, data) => request(`/subjects/${id}`, 'PUT', data),
    delete: (id) => request(`/subjects/${id}`, 'DELETE'),
    getAll: () => request('/subjects'),
    findById: (id) => request(`/subjects/${id}`),
    findByCode: async (code) => {
      const all = await request('/subjects');
      return all.find(s => s.subjectCode === code);
    },
    count: async () => (await request('/subjects')).length,
  };

  // ---------- QUESTIONS ----------
  const Questions = {
    create: (data) => request('/questions', 'POST', data),
    update: (id, data) => request(`/questions/${id}`, 'PUT', data),
    delete: (id) => request(`/questions/${id}`, 'DELETE'),
    getAll: () => request('/questions'),
    findById: (id) => request(`/questions/${id}`),
    findBySubject: async (subjectId) => {
      const all = await request('/questions');
      return all.filter(q => q.subjectId === subjectId);
    },
    count: async () => (await request('/questions')).length,
  };

  // ---------- EXAMS ----------
  const Exams = {
    create: (data) => request('/exams', 'POST', data),
    update: (id, data) => request(`/exams/${id}`, 'PUT', data),
    delete: (id) => request(`/exams/${id}`, 'DELETE'),
    getAll: () => request('/exams'),
    findById: (id) => request(`/exams/${id}`),
    findBySubject: async (subjectId) => {
      const all = await request('/exams');
      return all.filter(e => e.subjectId === subjectId);
    },
    findActive: async () => {
      const all = await request('/exams');
      return all.filter(e => e.status === 'active');
    },
    count: async () => (await request('/exams')).length,
    getUpcoming: async () => {
      const all = await request('/exams');
      return all.filter(e => e.status === 'upcoming' || e.status === 'active');
    },
  };

  // ---------- REGISTRATIONS ----------
  const Registrations = {
    create: (data) => request('/registrations', 'POST', data),
    delete: (id) => request(`/registrations/${id}`, 'DELETE'),
    findByStudent: async (studentId) => {
      const all = await request('/registrations');
      return all.filter(r => r.studentId === studentId);
    },
    findByExam: async (examId) => {
      const all = await request('/registrations');
      return all.filter(r => r.examId === examId);
    },
    findByStudentAndExam: async (studentId, examId) => {
      const all = await request('/registrations');
      return all.find(r => r.studentId === studentId && r.examId === examId);
    },
    getAll: () => request('/registrations'),
    count: async () => (await request('/registrations')).length,
  };

  // ---------- RESULTS ----------
  const Results = {
    create: (data) => request('/results', 'POST', data),
    update: (id, data) => request(`/results/${id}`, 'PUT', data),
    getAll: () => request('/results'),
    findById: (id) => request(`/results/${id}`),
    findByStudent: async (studentId) => {
      const all = await request('/results');
      return all.filter(r => r.studentId === studentId);
    },
    findByExam: async (examId) => {
      const all = await request('/results');
      return all.filter(r => r.examId === examId);
    },
    findByStudentAndExam: async (studentId, examId) => {
      const all = await request('/results');
      return all.find(r => r.studentId === studentId && r.examId === examId);
    },
    count: async () => (await request('/results')).length,
    avgScore: async () => {
      const rs = await request('/results');
      if (!rs.length) return 0;
      return Math.round(rs.reduce((a, r) => a + (r.percentage || 0), 0) / rs.length);
    },
  };

  // ---------- SESSION ----------
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
    Exams, Registrations, Results, Session,
    seed: async () => { console.log('Backend handles seeding automagically.'); }
  };
})();
