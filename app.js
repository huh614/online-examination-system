/**
 * ========================================
 * ONLINE EXAMINATION SYSTEM - App Logic
 * ========================================
 */

// =============================================
// APP STATE
// =============================================
const App = {
  currentPage: 'landing',
  currentSection: null,
  examState: {
    examId: null,
    questions: [],
    answers: {},
    currentQ: 0,
    timerInterval: null,
    timeLeft: 0,
    startTime: null,
  },
  filters: {},
};

// =============================================
// UTILITY FUNCTIONS
// =============================================

function toast(title, message = '', type = 'info') {
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const container = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-message">${message}</div>` : ''}
    </div>
  `;
  container.appendChild(t);
  setTimeout(() => {
    t.classList.add('removing');
    setTimeout(() => t.remove(), 300);
  }, 3500);
}

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pg = document.getElementById(`page-${pageId}`);
  if (pg) {
    pg.classList.add('active');
    App.currentPage = pageId;
  }
}

function openModal(modalId) {
  document.getElementById(modalId)?.classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId)?.classList.remove('active');
}

function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getInitials(name) {
  return name ? name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '??';
}

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getScoreColor(pct) {
  if (pct >= 75) return '#10b981';
  if (pct >= 50) return '#f59e0b';
  return '#ef4444';
}

function getGradeLabel(pct) {
  if (pct >= 90) return { grade: 'A+', label: 'Outstanding', color: '#10b981' };
  if (pct >= 75) return { grade: 'A',  label: 'Excellent',   color: '#10b981' };
  if (pct >= 60) return { grade: 'B',  label: 'Good',        color: '#6c63ff' };
  if (pct >= 50) return { grade: 'C',  label: 'Average',     color: '#f59e0b' };
  if (pct >= 40) return { grade: 'D',  label: 'Below Avg',   color: '#f59e0b' };
  return { grade: 'F', label: 'Fail', color: '#ef4444' };
}

// =============================================
// AUTH
// =============================================

let loginRole = 'student';
let registerRole = 'student';

function initAuthPage(type) {
  const page = type === 'login' ? 'login' : 'register';
  showPage(page);

  // Role buttons
  document.querySelectorAll(`#page-${page} .role-btn`).forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll(`#page-${page} .role-btn`).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (type === 'login') loginRole = btn.dataset.role;
      else registerRole = btn.dataset.role;
    });
  });

  // Set first role active
  document.querySelector(`#page-${page} .role-btn[data-role="student"]`)?.classList.add('active');
}

function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value.trim();

  if (!username || !password) { toast('Missing fields', 'Enter username and password', 'warning'); return; }

  const user = DB.Users.findByUsernameAndRole(username, loginRole);
  if (!user || user.password !== password) {
    toast('Login Failed', 'Invalid credentials or wrong role selected', 'error');
    return;
  }

  let profile;
  if (loginRole === 'admin') {
    profile = DB.Admins.findByUserId(user.id);
  } else {
    profile = DB.Students.findByUserId(user.id);
  }

  DB.Session.set(user, profile);

  toast('Welcome back! 🎉', `Logged in as ${profile?.studentName || profile?.adminName || username}`, 'success');

  setTimeout(() => {
    if (loginRole === 'admin') {
      loadAdminDashboard();
    } else {
      loadStudentDashboard();
    }
  }, 600);
}

function handleRegister(e) {
  e.preventDefault();
  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value.trim();
  const confirm  = document.getElementById('reg-confirm').value.trim();
  const fullname = document.getElementById('reg-fullname').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const contact  = document.getElementById('reg-contact').value.trim();

  if (!username || !password || !fullname || !email) {
    toast('Missing fields', 'Please fill all required fields', 'warning'); return;
  }
  if (password !== confirm) {
    toast('Password Mismatch', 'Passwords do not match', 'error'); return;
  }
  if (password.length < 6) {
    toast('Weak Password', 'Minimum 6 characters required', 'warning'); return;
  }

  const existing = DB.Users.findByUsernameAndRole(username, registerRole);
  if (existing) {
    toast('Username Taken', 'Choose a different username', 'error'); return;
  }

  const user = DB.Users.create({ username, password, role: registerRole, email });

  if (registerRole === 'student') {
    const student = DB.Students.create({ userId: user.id, studentName: fullname, studentContact: contact, email });
    // Auto-register for active exams
    DB.Exams.getAll().filter(ex => ex.status === 'active' || ex.status === 'upcoming').forEach(ex => {
      DB.Registrations.create({ studentId: student.id, examId: ex.id, registeredAt: new Date().toISOString() });
    });
    DB.Session.set(user, student);
    toast('Account Created! 🎉', 'Welcome to the system', 'success');
    setTimeout(() => loadStudentDashboard(), 600);
  } else {
    const admin = DB.Admins.create({ userId: user.id, adminName: fullname, adminContact: contact });
    DB.Session.set(user, admin);
    toast('Admin Account Created! 🎉', 'Welcome, Admin!', 'success');
    setTimeout(() => loadAdminDashboard(), 600);
  }
}

function logout() {
  if (App.examState.timerInterval) {
    clearInterval(App.examState.timerInterval);
    App.examState.timerInterval = null;
  }
  DB.Session.clear();
  toast('Logged out', 'See you next time!', 'info');
  setTimeout(() => showPage('landing'), 500);
}

// =============================================
// ADMIN DASHBOARD
// =============================================

function loadAdminDashboard() {
  showPage('admin-dashboard');
  const session = DB.Session.get();
  if (!session) { showPage('login'); return; }

  const adminName = session.profile?.adminName || 'Admin';
  document.getElementById('admin-user-name').textContent = adminName;
  document.getElementById('admin-user-initials').textContent = getInitials(adminName);

  // Update stats
  updateAdminStats();

  // Load default section
  loadAdminSection('admin-overview');
}

function updateAdminStats() {
  document.getElementById('stat-students').textContent = DB.Students.count();
  document.getElementById('stat-exams').textContent    = DB.Exams.count();
  document.getElementById('stat-questions').textContent = DB.Questions.count();
  document.getElementById('stat-subjects').textContent = DB.Subjects.count();
}

function loadAdminSection(section) {
  App.currentSection = section;

  // Update nav active state
  document.querySelectorAll('#admin-sidebar .nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.section === section);
  });

  // Hide all sections
  document.querySelectorAll('.admin-section').forEach(sec => sec.style.display = 'none');

  // Show section
  const secEl = document.getElementById(section);
  if (secEl) {
    secEl.style.display = 'block';
    // Populate data
    switch(section) {
      case 'admin-overview':    renderAdminOverview(); break;
      case 'manage-students':   renderStudentsTable(); break;
      case 'manage-subjects':   renderSubjectsTable(); break;
      case 'manage-questions':  renderQuestionsTable(); break;
      case 'manage-exams':      renderExamsTable(); break;
      case 'view-registrations': renderRegistrationsTable(); break;
      case 'view-results':      renderResultsTable(); break;
    }
  }
}

// --- OVERVIEW ---
function renderAdminOverview() {
  updateAdminStats();

  // Recent results
  const results = DB.Results.getAll().slice(-5).reverse();
  const tbody = document.getElementById('recent-results-body');
  if (!results.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:32px">No results yet</td></tr>`;
    return;
  }
  tbody.innerHTML = results.map(r => {
    const student = DB.Students.findById(r.studentId);
    const exam    = DB.Exams.findById(r.examId);
    const pct     = r.percentage;
    const grade   = getGradeLabel(pct);
    return `
      <tr>
        <td>
          <div class="flex items-center gap-2">
            <div class="user-avatar" style="width:32px;height:32px;font-size:12px">${getInitials(student?.studentName || '?')}</div>
            <span>${student?.studentName || 'Unknown'}</span>
          </div>
        </td>
        <td>${exam?.examName || 'Unknown'}</td>
        <td><span style="color:${getScoreColor(pct)};font-weight:700">${r.score}/${r.totalMarks}</span></td>
        <td><span style="color:${getScoreColor(pct)};font-weight:700">${pct}%</span></td>
        <td><span class="badge" style="background:${grade.color}22;color:${grade.color};border-color:${grade.color}44">${grade.grade} - ${grade.label}</span></td>
      </tr>
    `;
  }).join('');

  // Active exams
  const active = DB.Exams.findActive();
  const activeEl = document.getElementById('active-exams-count');
  if (activeEl) activeEl.textContent = active.length;

  // Chart bars
  const subjects = DB.Subjects.getAll().slice(0, 6);
  const chartEl = document.getElementById('overview-chart');
  if (chartEl && subjects.length) {
    chartEl.innerHTML = subjects.map(sub => {
      const qCount = DB.Questions.findBySubject(sub.id).length;
      const h = Math.max(10, Math.min(100, qCount * 8));
      return `<div class="chart-bar" style="height:${h}%" title="${sub.subjectName}: ${qCount} questions"></div>`;
    }).join('');
  }
}

// --- STUDENTS TABLE ---
function renderStudentsTable(search = '') {
  let students = DB.Students.getAll();
  if (search) students = students.filter(s =>
    s.studentName.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase())
  );

  const tbody = document.getElementById('students-tbody');
  if (!students.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:40px">
      <div style="font-size:40px;margin-bottom:12px">👤</div>No students found</td></tr>`;
    return;
  }

  tbody.innerHTML = students.map(s => {
    const user = DB.Users.findById(s.userId);
    const regCount = DB.Registrations.findByStudent(s.id).length;
    const results  = DB.Results.findByStudent(s.id);
    const avgPct   = results.length ? Math.round(results.reduce((a,r) => a + r.percentage, 0) / results.length) : null;
    return `
      <tr>
        <td>
          <div class="flex items-center gap-2">
            <div class="user-avatar" style="width:36px;height:36px;font-size:14px">${getInitials(s.studentName)}</div>
            <div>
              <div style="font-weight:600">${s.studentName}</div>
              <div class="text-sm text-muted">${s.email || '-'}</div>
            </div>
          </div>
        </td>
        <td><code style="color:var(--primary-light);font-size:12px">${s.id}</code></td>
        <td>${user?.username || '-'}</td>
        <td>${s.studentContact || '-'}</td>
        <td><span class="badge badge-primary">${regCount} exams</span></td>
        <td>${avgPct !== null ? `<span style="color:${getScoreColor(avgPct)};font-weight:700">${avgPct}%</span>` : '<span class="text-muted">No results</span>'}</td>
        <td>
          <div class="flex gap-2">
            <button class="btn btn-sm btn-secondary" onclick="editStudent('${s.id}')">✏️ Edit</button>
            <button class="btn btn-sm btn-danger" onclick="deleteStudent('${s.id}')">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function editStudent(id) {
  const s = DB.Students.findById(id);
  if (!s) return;
  document.getElementById('edit-student-id').value = id;
  document.getElementById('edit-student-name').value = s.studentName;
  document.getElementById('edit-student-contact').value = s.studentContact || '';
  document.getElementById('edit-student-email').value = s.email || '';
  openModal('modal-edit-student');
}

function saveEditStudent(e) {
  e.preventDefault();
  const id = document.getElementById('edit-student-id').value;
  const name    = document.getElementById('edit-student-name').value.trim();
  const contact = document.getElementById('edit-student-contact').value.trim();
  const email   = document.getElementById('edit-student-email').value.trim();
  DB.Students.update(id, { studentName: name, studentContact: contact, email });
  toast('Student Updated', `${name}'s profile updated`, 'success');
  closeModal('modal-edit-student');
  renderStudentsTable();
}

function deleteStudent(id) {
  const s = DB.Students.findById(id);
  if (confirm(`Delete student "${s?.studentName}"? This cannot be undone.`)) {
    DB.Students.delete(id);
    toast('Student Deleted', '', 'success');
    renderStudentsTable();
    updateAdminStats();
  }
}

// --- SUBJECTS TABLE ---
function renderSubjectsTable() {
  const subjects = DB.Subjects.getAll();
  const tbody = document.getElementById('subjects-tbody');
  if (!subjects.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:40px">No subjects yet</td></tr>`;
    return;
  }
  tbody.innerHTML = subjects.map(s => {
    const qCount = DB.Questions.findBySubject(s.id).length;
    const eCount = DB.Exams.findBySubject(s.id).length;
    return `
      <tr>
        <td><code style="color:var(--secondary);font-weight:600">${s.subjectCode}</code></td>
        <td style="font-weight:500">${s.subjectName}</td>
        <td><span class="badge badge-secondary">${s.department || '-'}</span></td>
        <td>${s.semester || '-'}</td>
        <td><span class="badge badge-cyan">${qCount} Qs</span></td>
        <td><span class="badge badge-primary">${eCount} Exams</span></td>
        <td>
          <div class="flex gap-2">
            <button class="btn btn-sm btn-secondary" onclick="editSubject('${s.id}')">✏️ Edit</button>
            <button class="btn btn-sm btn-danger" onclick="deleteSubject('${s.id}')">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function openAddSubject() {
  document.getElementById('form-add-subject').reset();
  openModal('modal-add-subject');
}

function saveNewSubject(e) {
  e.preventDefault();
  const code = document.getElementById('sub-code').value.trim();
  const name = document.getElementById('sub-name').value.trim();
  const dept = document.getElementById('sub-dept').value.trim();
  const sem  = document.getElementById('sub-sem').value.trim();
  if (!code || !name) { toast('Missing fields', '', 'warning'); return; }
  if (DB.Subjects.findByCode(code)) { toast('Code exists', 'Subject code already in use', 'error'); return; }
  DB.Subjects.create({ subjectCode: code, subjectName: name, department: dept, semester: sem });
  toast('Subject Added', `${name} created`, 'success');
  closeModal('modal-add-subject');
  renderSubjectsTable();
  updateAdminStats();
  refreshSubjectDropdowns();
}

function editSubject(id) {
  const s = DB.Subjects.findById(id);
  if (!s) return;
  document.getElementById('edit-sub-id').value = id;
  document.getElementById('edit-sub-code').value = s.subjectCode;
  document.getElementById('edit-sub-name').value = s.subjectName;
  document.getElementById('edit-sub-dept').value = s.department || '';
  document.getElementById('edit-sub-sem').value = s.semester || '';
  openModal('modal-edit-subject');
}

function saveEditSubject(e) {
  e.preventDefault();
  const id   = document.getElementById('edit-sub-id').value;
  const code = document.getElementById('edit-sub-code').value.trim();
  const name = document.getElementById('edit-sub-name').value.trim();
  const dept = document.getElementById('edit-sub-dept').value.trim();
  const sem  = document.getElementById('edit-sub-sem').value.trim();
  DB.Subjects.update(id, { subjectCode: code, subjectName: name, department: dept, semester: sem });
  toast('Subject Updated', '', 'success');
  closeModal('modal-edit-subject');
  renderSubjectsTable();
  refreshSubjectDropdowns();
}

function deleteSubject(id) {
  const s = DB.Subjects.findById(id);
  if (confirm(`Delete subject "${s?.subjectName}"?`)) {
    DB.Subjects.delete(id);
    toast('Subject Deleted', '', 'success');
    renderSubjectsTable();
    updateAdminStats();
  }
}

function refreshSubjectDropdowns() {
  const subjects = DB.Subjects.getAll();
  const opts = `<option value="">-- Select Subject --</option>` +
    subjects.map(s => `<option value="${s.id}">${s.subjectCode} - ${s.subjectName}</option>`).join('');
  ['q-subject', 'exam-subject', 'q-filter-subject'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts;
  });
}

// --- QUESTIONS TABLE ---
function renderQuestionsTable(subjectFilter = '', search = '') {
  let questions = DB.Questions.getAll();
  if (subjectFilter) questions = questions.filter(q => q.subjectId === subjectFilter);
  if (search) questions = questions.filter(q => q.text.toLowerCase().includes(search.toLowerCase()));

  const tbody = document.getElementById('questions-tbody');
  if (!questions.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:40px">No questions found</td></tr>`;
    return;
  }

  const levelColors = { easy: 'badge-success', medium: 'badge-warning', hard: 'badge-danger' };

  tbody.innerHTML = questions.map((q, i) => {
    const subject = DB.Subjects.findById(q.subjectId);
    return `
      <tr>
        <td style="color:var(--text-muted);font-size:12px">${i + 1}</td>
        <td style="max-width:400px">
          <div style="font-weight:500;line-height:1.5">${q.text}</div>
          <div class="text-sm text-muted" style="margin-top:4px">✓ ${q.options?.[q.correct] || '-'}</div>
        </td>
        <td>${subject?.subjectCode || '-'}</td>
        <td><span class="badge badge-secondary">${q.type || 'MCQ'}</span></td>
        <td><span class="badge ${levelColors[q.level] || 'badge-secondary'}">${q.level || '-'}</span></td>
        <td>
          <div class="flex gap-2">
            <button class="btn btn-sm btn-secondary" onclick="editQuestion('${q.id}')">✏️</button>
            <button class="btn btn-sm btn-danger" onclick="deleteQuestion('${q.id}')">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function openAddQuestion() {
  document.getElementById('form-add-question').reset();
  refreshSubjectDropdowns();
  openModal('modal-add-question');
}

function saveNewQuestion(e) {
  e.preventDefault();
  const text      = document.getElementById('q-text').value.trim();
  const subjectId = document.getElementById('q-subject').value;
  const type      = document.getElementById('q-type').value;
  const level     = document.getElementById('q-level').value;
  const correct   = parseInt(document.getElementById('q-correct').value);
  const options   = [0,1,2,3].map(i => document.getElementById(`q-opt-${i}`).value.trim());

  if (!text || !subjectId || options.some(o => !o)) {
    toast('Missing fields', 'Fill all options and select subject', 'warning'); return;
  }

  DB.Questions.create({ text, subjectId, type, level, correct, options });
  toast('Question Added', '', 'success');
  closeModal('modal-add-question');
  renderQuestionsTable();
  updateAdminStats();
}

function editQuestion(id) {
  const q = DB.Questions.findById(id);
  if (!q) return;
  refreshSubjectDropdowns();

  document.getElementById('edit-q-id').value = id;
  document.getElementById('edit-q-text').value = q.text;
  document.getElementById('edit-q-subject').value = q.subjectId;
  document.getElementById('edit-q-type').value = q.type;
  document.getElementById('edit-q-level').value = q.level;
  document.getElementById('edit-q-correct').value = q.correct;
  [0,1,2,3].forEach(i => { document.getElementById(`edit-q-opt-${i}`).value = q.options[i] || ''; });
  openModal('modal-edit-question');
}

function saveEditQuestion(e) {
  e.preventDefault();
  const id      = document.getElementById('edit-q-id').value;
  const text    = document.getElementById('edit-q-text').value.trim();
  const subjectId = document.getElementById('edit-q-subject').value;
  const type    = document.getElementById('edit-q-type').value;
  const level   = document.getElementById('edit-q-level').value;
  const correct = parseInt(document.getElementById('edit-q-correct').value);
  const options = [0,1,2,3].map(i => document.getElementById(`edit-q-opt-${i}`).value.trim());
  DB.Questions.update(id, { text, subjectId, type, level, correct, options });
  toast('Question Updated', '', 'success');
  closeModal('modal-edit-question');
  renderQuestionsTable();
}

function deleteQuestion(id) {
  if (confirm('Delete this question?')) {
    DB.Questions.delete(id);
    toast('Question Deleted', '', 'success');
    renderQuestionsTable();
    updateAdminStats();
  }
}

// --- EXAMS TABLE ---
function renderExamsTable() {
  const exams = DB.Exams.getAll();
  const tbody = document.getElementById('exams-tbody');
  if (!exams.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:40px">No exams created yet</td></tr>`;
    return;
  }

  const statusColors = {
    upcoming:  'badge-secondary',
    active:    'badge-success',
    completed: 'badge-primary',
    cancelled: 'badge-danger',
  };

  tbody.innerHTML = exams.map(ex => {
    const subject = DB.Subjects.findById(ex.subjectId);
    const regCount = DB.Registrations.findByExam(ex.id).length;
    return `
      <tr>
        <td style="font-weight:600">${ex.examName}</td>
        <td>${subject?.subjectCode || '-'}</td>
        <td>${formatDate(ex.examDate)}</td>
        <td>${ex.examTime || '-'}</td>
        <td>${ex.duration} min</td>
        <td><span class="badge ${statusColors[ex.status] || 'badge-secondary'}">${ex.status}</span></td>
        <td><span class="badge badge-cyan">${regCount} students</span></td>
        <td>
          <div class="flex gap-2">
            <button class="btn btn-sm btn-secondary" onclick="editExam('${ex.id}')">✏️</button>
            <button class="btn btn-sm btn-warning" onclick="toggleExamStatus('${ex.id}')">⚡</button>
            <button class="btn btn-sm btn-danger" onclick="deleteExam('${ex.id}')">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function openAddExam() {
  document.getElementById('form-add-exam').reset();
  refreshSubjectDropdowns();
  openModal('modal-add-exam');
}

function saveNewExam(e) {
  e.preventDefault();
  const name      = document.getElementById('exam-name').value.trim();
  const subjectId = document.getElementById('exam-subject').value;
  const date      = document.getElementById('exam-date').value;
  const time      = document.getElementById('exam-time').value;
  const duration  = parseInt(document.getElementById('exam-duration').value);
  const total     = parseInt(document.getElementById('exam-total-marks').value);
  const passing   = parseInt(document.getElementById('exam-passing-marks').value);
  const status    = document.getElementById('exam-status').value;
  const instructions = document.getElementById('exam-instructions').value.trim();

  if (!name || !subjectId || !date || !duration) {
    toast('Missing fields', '', 'warning'); return;
  }

  // Pick questions from subject
  const qPool = DB.Questions.findBySubject(subjectId);
  const maxQ = Math.min(total, qPool.length);
  const selected = qPool.sort(() => Math.random() - 0.5).slice(0, maxQ);
  const session = DB.Session.get();

  const exam = DB.Exams.create({
    examName: name, subjectId, examDate: date, examTime: time,
    duration, totalMarks: total, passingMarks: passing,
    status, instructions, adminId: session?.user?.id,
    questionIds: selected.map(q => q.id),
  });

  // Register all students
  DB.Students.getAll().forEach(s => {
    DB.Registrations.create({ studentId: s.id, examId: exam.id, registeredAt: new Date().toISOString() });
  });

  toast('Exam Created', `${name} - ${selected.length} questions selected`, 'success');
  closeModal('modal-add-exam');
  renderExamsTable();
  updateAdminStats();
}

function editExam(id) {
  const ex = DB.Exams.findById(id);
  if (!ex) return;
  refreshSubjectDropdowns();
  document.getElementById('edit-exam-id').value = id;
  document.getElementById('edit-exam-name').value = ex.examName;
  document.getElementById('edit-exam-subject').value = ex.subjectId;
  document.getElementById('edit-exam-date').value = ex.examDate;
  document.getElementById('edit-exam-time').value = ex.examTime;
  document.getElementById('edit-exam-duration').value = ex.duration;
  document.getElementById('edit-exam-status').value = ex.status;
  openModal('modal-edit-exam');
}

function saveEditExam(e) {
  e.preventDefault();
  const id   = document.getElementById('edit-exam-id').value;
  const name = document.getElementById('edit-exam-name').value.trim();
  const subjectId = document.getElementById('edit-exam-subject').value;
  const date = document.getElementById('edit-exam-date').value;
  const time = document.getElementById('edit-exam-time').value;
  const duration = parseInt(document.getElementById('edit-exam-duration').value);
  const status = document.getElementById('edit-exam-status').value;
  DB.Exams.update(id, { examName: name, subjectId, examDate: date, examTime: time, duration, status });
  toast('Exam Updated', '', 'success');
  closeModal('modal-edit-exam');
  renderExamsTable();
}

function toggleExamStatus(id) {
  const ex = DB.Exams.findById(id);
  if (!ex) return;
  const cycle = { upcoming: 'active', active: 'completed', completed: 'upcoming' };
  const newStatus = cycle[ex.status] || 'upcoming';
  DB.Exams.update(id, { status: newStatus });
  toast('Status Updated', `Exam is now "${newStatus}"`, 'success');
  renderExamsTable();
}

function deleteExam(id) {
  if (confirm('Delete this exam and all related registrations?')) {
    DB.Exams.delete(id);
    toast('Exam Deleted', '', 'success');
    renderExamsTable();
    updateAdminStats();
  }
}

// --- REGISTRATIONS ---
function renderRegistrationsTable() {
  const regs = DB.Registrations.getAll();
  const tbody = document.getElementById('registrations-tbody');
  if (!regs.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:40px">No registrations</td></tr>`;
    return;
  }
  tbody.innerHTML = regs.map(r => {
    const student = DB.Students.findById(r.studentId);
    const exam    = DB.Exams.findById(r.examId);
    const result  = DB.Results.findByStudentAndExam(r.studentId, r.examId);
    return `
      <tr>
        <td>${student?.studentName || 'Unknown'}</td>
        <td>${exam?.examName || 'Unknown'}</td>
        <td>${formatDate(r.registeredAt)}</td>
        <td>
          ${result
            ? `<span class="badge ${result.passed ? 'badge-success' : 'badge-danger'}">${result.passed ? '✓ Appeared' : '✗ Failed'}</span>`
            : `<span class="badge badge-warning">Pending</span>`}
        </td>
      </tr>
    `;
  }).join('');
}

// --- RESULTS ---
function renderResultsTable() {
  const results = DB.Results.getAll().reverse();
  const tbody = document.getElementById('results-tbody');
  if (!results.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:40px">No results yet</td></tr>`;
    return;
  }
  tbody.innerHTML = results.map(r => {
    const student = DB.Students.findById(r.studentId);
    const exam    = DB.Exams.findById(r.examId);
    const grade   = getGradeLabel(r.percentage);
    return `
      <tr>
        <td>
          <div class="flex items-center gap-2">
            <div class="user-avatar" style="width:32px;height:32px;font-size:12px">${getInitials(student?.studentName || '?')}</div>
            <span>${student?.studentName || 'Unknown'}</span>
          </div>
        </td>
        <td>${exam?.examName || 'Unknown'}</td>
        <td style="color:${getScoreColor(r.percentage)};font-weight:700">${r.score}/${r.totalMarks}</td>
        <td style="color:${getScoreColor(r.percentage)};font-weight:700">${r.percentage}%</td>
        <td><span class="badge" style="background:${grade.color}22;color:${grade.color};border-color:${grade.color}44">${grade.grade}</span></td>
        <td><span class="badge ${r.passed ? 'badge-success' : 'badge-danger'}">${r.passed ? '✓ Pass' : '✗ Fail'}</span></td>
        <td>${r.timeTaken ? `${r.timeTaken} min` : '-'}</td>
        <td>${formatDate(r.resultDate)}</td>
      </tr>
    `;
  }).join('');
}

// =============================================
// STUDENT DASHBOARD
// =============================================

function loadStudentDashboard() {
  showPage('student-dashboard');
  const session = DB.Session.get();
  if (!session) { showPage('login'); return; }

  const studentName = session.profile?.studentName || 'Student';
  document.getElementById('stu-user-name').textContent = studentName;
  document.getElementById('stu-user-initials').textContent = getInitials(studentName);

  loadStudentSection('stu-overview');
}

function loadStudentSection(section) {
  App.currentSection = section;

  document.querySelectorAll('#student-sidebar .nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.section === section);
  });

  document.querySelectorAll('.student-section').forEach(sec => sec.style.display = 'none');

  const secEl = document.getElementById(section);
  if (secEl) {
    secEl.style.display = 'block';
    switch(section) {
      case 'stu-overview':   renderStudentOverview(); break;
      case 'stu-exams':      renderStudentExams(); break;
      case 'stu-results':    renderStudentResults(); break;
      case 'stu-profile':    renderStudentProfile(); break;
    }
  }
}

function renderStudentOverview() {
  const session = DB.Session.get();
  const student = session.profile;

  const regs = DB.Registrations.findByStudent(student.id);
  const results = DB.Results.findByStudent(student.id);
  const pending = regs.filter(r => !DB.Results.findByStudentAndExam(student.id, r.examId));

  document.getElementById('stu-stat-registered').textContent = regs.length;
  document.getElementById('stu-stat-appeared').textContent   = results.length;
  document.getElementById('stu-stat-pending').textContent    = pending.length;

  const avgPct = results.length
    ? Math.round(results.reduce((a,r) => a + r.percentage, 0) / results.length)
    : 0;
  const avgEl = document.getElementById('stu-stat-avg');
  if (avgEl) {
    avgEl.textContent = results.length ? `${avgPct}%` : '-';
    avgEl.style.color = results.length ? getScoreColor(avgPct) : '';
  }

  // Upcoming exams
  const upcomingEl = document.getElementById('stu-upcoming-list');
  const upcoming = regs
    .map(r => DB.Exams.findById(r.examId))
    .filter(e => e && (e.status === 'active' || e.status === 'upcoming'))
    .slice(0, 3);

  if (!upcoming.length) {
    upcomingEl.innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><div class="empty-title">No upcoming exams</div></div>`;
  } else {
    upcomingEl.innerHTML = upcoming.map(ex => {
      const sub = DB.Subjects.findById(ex.subjectId);
      const hasResult = DB.Results.findByStudentAndExam(student.id, ex.id);
      return `
        <div class="card mb-4 animate-in" style="cursor:${hasResult ? 'default' : 'pointer'}" ${!hasResult ? `onclick="startExamFlow('${ex.id}')"` : ''}>
          <div class="flex items-center justify-between">
            <div>
              <div style="font-weight:600;margin-bottom:4px">${ex.examName}</div>
              <div class="text-sm text-muted">${sub?.subjectCode} • ${ex.duration} min • ${ex.totalMarks} marks</div>
            </div>
            ${hasResult
              ? `<span class="badge badge-success">Completed</span>`
              : `<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();startExamFlow('${ex.id}')">Start Exam →</button>`
            }
          </div>
        </div>
      `;
    }).join('');
  }

  // Recent results
  const recentResultsEl = document.getElementById('stu-recent-results');
  const recentResults = results.slice(-3).reverse();
  if (!recentResults.length) {
    recentResultsEl.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div><div class="empty-title">No results yet</div></div>`;
  } else {
    recentResultsEl.innerHTML = recentResults.map(r => {
      const exam = DB.Exams.findById(r.examId);
      const grade = getGradeLabel(r.percentage);
      return `
        <div class="card animate-in" style="margin-bottom:12px">
          <div class="flex items-center justify-between">
            <div>
              <div style="font-weight:600;margin-bottom:4px">${exam?.examName || 'Exam'}</div>
              <div class="text-sm text-muted">${formatDate(r.resultDate)}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:22px;font-weight:800;color:${grade.color}">${r.score}/${r.totalMarks}</div>
              <span class="badge" style="background:${grade.color}22;color:${grade.color};border-color:${grade.color}44">${grade.grade}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
}

function renderStudentExams() {
  const session = DB.Session.get();
  const student = session.profile;
  const regs = DB.Registrations.findByStudent(student.id);
  const container = document.getElementById('stu-exams-list');

  if (!regs.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">Not registered for any exam</div></div>`;
    return;
  }

  const exams = regs.map(r => DB.Exams.findById(r.examId)).filter(Boolean);

  const statusColors = { upcoming: 'badge-secondary', active: 'badge-success', completed: 'badge-primary' };

  container.innerHTML = exams.map(ex => {
    const sub    = DB.Subjects.findById(ex.subjectId);
    const result = DB.Results.findByStudentAndExam(student.id, ex.id);
    const grade  = result ? getGradeLabel(result.percentage) : null;
    return `
      <div class="card animate-in" style="margin-bottom:16px">
        <div class="flex items-center justify-between" style="flex-wrap:wrap;gap:12px">
          <div>
            <div style="font-size:18px;font-weight:700;margin-bottom:6px">${ex.examName}</div>
            <div class="flex gap-3" style="flex-wrap:wrap">
              <span class="badge badge-secondary">📚 ${sub?.subjectName || '-'}</span>
              <span class="badge badge-secondary">📅 ${formatDate(ex.examDate)}</span>
              <span class="badge badge-secondary">⏰ ${ex.examTime}</span>
              <span class="badge badge-secondary">⏱ ${ex.duration} min</span>
              <span class="badge badge-secondary">📝 ${ex.totalMarks} marks</span>
            </div>
            ${ex.instructions ? `<div class="text-sm text-muted" style="margin-top:8px">ℹ️ ${ex.instructions}</div>` : ''}
          </div>
          <div style="text-align:right;flex-shrink:0">
            ${result
              ? `<div style="font-size:28px;font-weight:800;color:${grade.color}">${result.score}/${result.totalMarks}</div>
                 <div class="text-sm text-muted">${result.percentage}% • ${grade.grade}</div>`
              : ''}
            <div class="flex gap-2" style="margin-top:8px">
              <span class="badge ${statusColors[ex.status] || 'badge-secondary'}">${ex.status}</span>
              ${(ex.status === 'active' && !result)
                ? `<button class="btn btn-primary btn-sm" onclick="startExamFlow('${ex.id}')">🚀 Start Exam</button>`
                : result
                  ? `<button class="btn btn-secondary btn-sm" onclick="viewResultDetail('${result.id}')">📊 View Result</button>`
                  : `<span class="badge badge-secondary">Not Available</span>`
              }
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderStudentResults() {
  const session = DB.Session.get();
  const student = session.profile;
  const results = DB.Results.findByStudent(student.id).reverse();
  const container = document.getElementById('stu-results-list');

  if (!results.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div><div class="empty-title">No results yet</div><div class="empty-desc">Appear in exams to see your results here</div></div>`;
    return;
  }

  container.innerHTML = results.map(r => {
    const exam  = DB.Exams.findById(r.examId);
    const sub   = DB.Subjects.findById(exam?.subjectId);
    const grade = getGradeLabel(r.percentage);
    return `
      <div class="card animate-in" style="margin-bottom:16px;cursor:pointer" onclick="viewResultDetail('${r.id}')">
        <div class="flex items-center justify-between" style="flex-wrap:wrap;gap:12px">
          <div>
            <div style="font-size:17px;font-weight:700;margin-bottom:6px">${exam?.examName || 'Exam'}</div>
            <div class="flex gap-2" style="flex-wrap:wrap">
              <span class="badge badge-secondary">${sub?.subjectCode || '-'}</span>
              <span class="badge badge-secondary">${formatDate(r.resultDate)}</span>
              <span class="badge badge-secondary">⏱ ${r.timeTaken || '-'} min</span>
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:36px;font-weight:900;color:${grade.color};line-height:1">${r.percentage}%</div>
            <div class="flex gap-2 justify-end" style="margin-top:6px">
              <span class="badge" style="background:${grade.color}22;color:${grade.color};border-color:${grade.color}44">${grade.grade} - ${grade.label}</span>
              <span class="badge ${r.passed ? 'badge-success' : 'badge-danger'}">${r.passed ? '✓ Pass' : '✗ Fail'}</span>
            </div>
          </div>
        </div>
        <div style="margin-top:16px">
          <div class="flex justify-between text-sm text-muted" style="margin-bottom:8px">
            <span>Score: ${r.score}/${r.totalMarks}</span>
            <span>${r.percentage}%</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${r.percentage}%;background:linear-gradient(90deg,${grade.color},${grade.color}aa)"></div></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderStudentProfile() {
  const session = DB.Session.get();
  const student = session.profile;
  const user    = session.user;

  document.getElementById('profile-initials').textContent = getInitials(student.studentName);
  document.getElementById('profile-name').textContent = student.studentName;
  document.getElementById('profile-id').textContent = student.id;
  document.getElementById('profile-username').textContent = user.username;
  document.getElementById('profile-email').textContent = student.email || '-';
  document.getElementById('profile-contact').textContent = student.studentContact || '-';
  document.getElementById('profile-joined').textContent = formatDate(student.createdAt);

  const results = DB.Results.findByStudent(student.id);
  const passed  = results.filter(r => r.passed).length;
  document.getElementById('profile-exams-taken').textContent = results.length;
  document.getElementById('profile-exams-passed').textContent = passed;
  const avg = results.length ? Math.round(results.reduce((a,r) => a + r.percentage, 0) / results.length) : 0;
  document.getElementById('profile-avg-score').textContent = results.length ? `${avg}%` : '-';
}

// =============================================
// EXAM TAKING ENGINE
// =============================================

function startExamFlow(examId) {
  const session = DB.Session.get();
  const student = session.profile;
  const exam    = DB.Exams.findById(examId);

  if (!exam) { toast('Exam not found', '', 'error'); return; }
  if (exam.status !== 'active') { toast('Exam not available', 'This exam is not currently active', 'warning'); return; }

  const already = DB.Results.findByStudentAndExam(student.id, examId);
  if (already) { toast('Already attempted', 'You have already submitted this exam', 'warning'); return; }

  // Build question list
  const questions = (exam.questionIds || []).map(qid => DB.Questions.findById(qid)).filter(Boolean);
  if (!questions.length) { toast('No questions', 'This exam has no questions assigned', 'error'); return; }

  // Populate exam UI
  document.getElementById('exam-title').textContent = exam.examName;
  document.getElementById('exam-subject-label').textContent = DB.Subjects.findById(exam.subjectId)?.subjectName || '';
  document.getElementById('exam-qs-count').textContent = questions.length;
  document.getElementById('exam-duration-label').textContent = `${exam.duration} min`;
  document.getElementById('exam-instructions-text').textContent = exam.instructions || 'No special instructions.';

  // Store state
  App.examState = {
    examId, questions,
    answers: {},
    currentQ: 0,
    timeLeft: exam.duration * 60,
    startTime: Date.now(),
    timerInterval: null,
    totalMarks: exam.totalMarks,
    passingMarks: exam.passingMarks,
  };

  showPage('take-exam');
  renderCurrentQuestion();
  startTimer();
}

function renderCurrentQuestion() {
  const { questions, currentQ, answers } = App.examState;
  const q = questions[currentQ];
  if (!q) return;

  // Update progress
  document.getElementById('q-progress-current').textContent = currentQ + 1;
  document.getElementById('q-progress-total').textContent = questions.length;
  const pct = Math.round(((currentQ + 1) / questions.length) * 100);
  document.getElementById('q-progress-bar').style.width = `${pct}%`;

  // Question content
  const levelHtml = { easy: '🟢 Easy', medium: '🟡 Medium', hard: '🔴 Hard' };

  document.getElementById('question-display').innerHTML = `
    <div class="question-card animate-in">
      <div class="question-header">
        <div class="question-number">${currentQ + 1}</div>
        <div class="question-meta">
          <span class="badge badge-secondary">${q.type || 'MCQ'}</span>
          <span class="badge badge-secondary">${levelHtml[q.level] || q.level}</span>
          <span class="badge badge-secondary">1 Mark</span>
        </div>
      </div>
      <div class="question-text">${q.text}</div>
      <div class="options-grid" id="options-container">
      ${(q.options || []).map((opt, i) => `
        <div class="option-item ${answers[q.id] === i ? 'selected' : ''}"
             onclick="selectOption(${i})" id="opt-${i}">
          <div class="option-letter">${String.fromCharCode(65 + i)}</div>
          <span>${opt}</span>
        </div>
      `).join('')}
      </div>
    </div>
  `;

  // Update palette
  renderPalette();

  // Nav buttons
  document.getElementById('btn-prev-q').disabled = currentQ === 0;
  document.getElementById('btn-next-q').textContent = currentQ === questions.length - 1 ? '⏩ Review & Submit' : 'Next →';
}

function selectOption(optIdx) {
  const { questions, currentQ } = App.examState;
  const q = questions[currentQ];
  App.examState.answers[q.id] = optIdx;

  document.querySelectorAll('.option-item').forEach((el, i) => {
    el.classList.toggle('selected', i === optIdx);
  });
  renderPalette();
}

function renderPalette() {
  const { questions, currentQ, answers } = App.examState;
  const container = document.getElementById('question-palette');
  container.innerHTML = questions.map((q, i) => {
    let cls = '';
    if (i === currentQ) cls = 'current';
    else if (answers[q.id] !== undefined) cls = 'answered';
    return `<div class="palette-item ${cls}" onclick="jumpToQuestion(${i})" title="Q${i+1}">${i+1}</div>`;
  }).join('');
}

function jumpToQuestion(idx) {
  App.examState.currentQ = idx;
  renderCurrentQuestion();
}

function prevQuestion() {
  if (App.examState.currentQ > 0) {
    App.examState.currentQ--;
    renderCurrentQuestion();
  }
}

function nextQuestion() {
  const { questions, currentQ } = App.examState;
  if (currentQ < questions.length - 1) {
    App.examState.currentQ++;
    renderCurrentQuestion();
  } else {
    reviewAndSubmit();
  }
}

function reviewAndSubmit() {
  const { questions, answers } = App.examState;
  const answered = Object.keys(answers).length;
  const unanswered = questions.length - answered;

  document.getElementById('review-answered').textContent = answered;
  document.getElementById('review-unanswered').textContent = unanswered;

  openModal('modal-submit-exam');
}

function submitExam() {
  closeModal('modal-submit-exam');
  clearInterval(App.examState.timerInterval);

  const { examId, questions, answers, startTime, totalMarks, passingMarks } = App.examState;
  const session  = DB.Session.get();
  const student  = session.profile;
  const exam     = DB.Exams.findById(examId);

  // Calculate score
  let score = 0;
  const detailedAnswers = {};
  questions.forEach(q => {
    const selected = answers[q.id];
    const isCorrect = selected === q.correct;
    if (isCorrect) score++;
    detailedAnswers[q.id] = { selected: selected ?? null, correct: q.correct, isCorrect };
  });

  const percentage  = Math.round((score / questions.length) * 100);
  const passed      = score >= (passingMarks || Math.ceil(questions.length * 0.5));
  const timeTakenMs = Date.now() - startTime;
  const timeTaken   = Math.round(timeTakenMs / 60000); // minutes

  const result = DB.Results.create({
    studentId: student.id,
    examId,
    score,
    totalMarks: questions.length,
    percentage,
    passed,
    resultName: `${student.studentName} - ${exam?.examName || 'Exam'} Result`,
    timeTaken,
    answers: detailedAnswers,
  });

  toast('Exam Submitted! 🎉', `Score: ${score}/${questions.length} (${percentage}%)`, passed ? 'success' : 'warning');

  setTimeout(() => showResultPage(result.id, questions, detailedAnswers), 700);
}

function startTimer() {
  const timerEl    = document.getElementById('exam-timer');
  const timerValue = document.getElementById('timer-value');

  App.examState.timerInterval = setInterval(() => {
    App.examState.timeLeft--;
    const t = App.examState.timeLeft;
    timerValue.textContent = formatTime(t);

    timerEl.className = 'exam-timer';
    if (t <= 60) timerEl.classList.add('danger');
    else if (t <= 300) timerEl.classList.add('warning');

    if (t <= 0) {
      clearInterval(App.examState.timerInterval);
      toast('Time Up!', 'Auto-submitting your exam', 'warning');
      submitExam();
    }
  }, 1000);

  timerValue.textContent = formatTime(App.examState.timeLeft);
}

// =============================================
// RESULT DETAIL
// =============================================

function showResultPage(resultId, questionsOverride = null, answersOverride = null) {
  const result    = DB.Results.findById(resultId);
  if (!result) return;

  const exam      = DB.Exams.findById(result.examId);
  const student   = DB.Students.findById(result.studentId);
  const grade     = getGradeLabel(result.percentage);

  // Populate result UI
  const ring = document.getElementById('result-score-ring');
  ring.style.setProperty('--pct', result.percentage);
  ring.style.background = `conic-gradient(${getScoreColor(result.percentage)} calc(${result.percentage} * 1%), var(--bg-elevated) 0)`;

  document.getElementById('result-score-value').textContent = `${result.percentage}%`;
  document.getElementById('result-score-value').style.color = grade.color;
  document.getElementById('result-grade').textContent = `${grade.grade} - ${grade.label}`;
  document.getElementById('result-grade').style.color = grade.color;
  document.getElementById('result-exam-name').textContent = exam?.examName || 'Exam';
  document.getElementById('result-student-name').textContent = student?.studentName || '-';
  document.getElementById('result-date').textContent = formatDate(result.resultDate);
  document.getElementById('result-correct').textContent = result.score;
  document.getElementById('result-wrong').textContent   = result.totalMarks - result.score;
  document.getElementById('result-total').textContent   = result.totalMarks;
  document.getElementById('result-time').textContent    = `${result.timeTaken || '-'} min`;
  document.getElementById('result-status-badge').innerHTML = result.passed
    ? `<span class="badge badge-success" style="font-size:16px;padding:8px 20px">✓ PASSED</span>`
    : `<span class="badge badge-danger" style="font-size:16px;padding:8px 20px">✗ FAILED</span>`;

  // Question review
  const questions = questionsOverride || (exam?.questionIds || []).map(qid => DB.Questions.findById(qid)).filter(Boolean);
  const detailedAnswers = answersOverride || result.answers || {};

  const reviewEl = document.getElementById('result-question-review');
  reviewEl.innerHTML = questions.map((q, i) => {
    const ansData = detailedAnswers[q.id];
    const selected = ansData?.selected ?? null;
    const correct  = ansData?.correct ?? q.correct;
    const isCorrect = ansData?.isCorrect ?? (selected === correct);

    return `
      <div class="question-card" style="margin-bottom:16px;border-left:3px solid ${isCorrect ? 'var(--success)' : 'var(--danger)'}">
        <div class="question-header">
          <div class="question-number" style="background:${isCorrect ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'};border-color:${isCorrect ? 'var(--success)' : 'var(--danger)'};color:${isCorrect ? 'var(--success)' : 'var(--danger)'}">${i+1}</div>
          <span class="badge ${isCorrect ? 'badge-success' : 'badge-danger'}">${isCorrect ? '✓ Correct' : '✗ Wrong'}</span>
        </div>
        <div class="question-text">${q.text}</div>
        <div class="options-grid">
          ${(q.options || []).map((opt, oi) => {
            let cls = '';
            if (oi === correct) cls = 'correct';
            else if (oi === selected && !isCorrect) cls = 'wrong';
            return `
              <div class="option-item ${cls}">
                <div class="option-letter">${String.fromCharCode(65+oi)}</div>
                <span>${opt}</span>
                ${oi === correct ? ' ✓' : ''}
                ${oi === selected && oi !== correct ? ' (Your answer)' : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');

  showPage('result');
}

function viewResultDetail(resultId) {
  showResultPage(resultId);
}

function goBackFromResult() {
  const session = DB.Session.get();
  if (!session) { showPage('landing'); return; }
  if (session.user.role === 'admin') {
    loadAdminSection('view-results');
  } else {
    loadStudentSection('stu-results');
  }
}

// =============================================
// INIT
// =============================================

document.addEventListener('DOMContentLoaded', () => {
  // Seed DB
  DB.seed();

  // Check existing session
  const session = DB.Session.get();
  if (session) {
    if (session.user.role === 'admin') loadAdminDashboard();
    else loadStudentDashboard();
  } else {
    showPage('landing');
  }

  // Landing page CTA buttons
  document.getElementById('btn-get-started')?.addEventListener('click', () => initAuthPage('login'));
  document.getElementById('btn-login-nav')?.addEventListener('click', () => initAuthPage('login'));
  document.getElementById('btn-register-nav')?.addEventListener('click', () => initAuthPage('register'));

  // Login form
  document.getElementById('login-form')?.addEventListener('submit', handleLogin);
  document.getElementById('btn-go-register')?.addEventListener('click', () => initAuthPage('register'));
  document.getElementById('btn-back-login')?.addEventListener('click', () => showPage('landing'));

  // Register form
  document.getElementById('register-form')?.addEventListener('submit', handleRegister);
  document.getElementById('btn-go-login')?.addEventListener('click', () => initAuthPage('login'));
  document.getElementById('btn-back-register')?.addEventListener('click', () => showPage('landing'));

  // Admin sidebar nav
  document.querySelectorAll('#admin-sidebar .nav-item[data-section]').forEach(item => {
    item.addEventListener('click', () => loadAdminSection(item.dataset.section));
  });

  // Student sidebar nav
  document.querySelectorAll('#student-sidebar .nav-item[data-section]').forEach(item => {
    item.addEventListener('click', () => loadStudentSection(item.dataset.section));
  });

  // Admin forms
  document.getElementById('form-add-subject')?.addEventListener('submit', saveNewSubject);
  document.getElementById('form-edit-subject')?.addEventListener('submit', saveEditSubject);
  document.getElementById('form-add-question')?.addEventListener('submit', saveNewQuestion);
  document.getElementById('form-edit-question')?.addEventListener('submit', saveEditQuestion);
  document.getElementById('form-add-exam')?.addEventListener('submit', saveNewExam);
  document.getElementById('form-edit-exam')?.addEventListener('submit', saveEditExam);
  document.getElementById('form-edit-student')?.addEventListener('submit', saveEditStudent);

  // Students search
  document.getElementById('student-search')?.addEventListener('input', (e) => {
    renderStudentsTable(e.target.value);
  });

  // Questions filter
  document.getElementById('q-filter-subject')?.addEventListener('change', (e) => {
    renderQuestionsTable(e.target.value, document.getElementById('q-search')?.value || '');
  });
  document.getElementById('q-search')?.addEventListener('input', (e) => {
    renderQuestionsTable(document.getElementById('q-filter-subject')?.value || '', e.target.value);
  });

  // Exam nav
  document.getElementById('btn-prev-q')?.addEventListener('click', prevQuestion);
  document.getElementById('btn-next-q')?.addEventListener('click', nextQuestion);
  document.getElementById('btn-submit-exam-review')?.addEventListener('click', reviewAndSubmit);
  document.getElementById('btn-confirm-submit')?.addEventListener('click', submitExam);

  // Modal closes
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal-overlay');
      if (modal) modal.classList.remove('active');
    });
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('active');
    });
  });

  // Result back
  document.getElementById('btn-result-back')?.addEventListener('click', goBackFromResult);

  // Refresh subject dropdowns on load
  refreshSubjectDropdowns();
});
