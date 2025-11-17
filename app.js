// Teacher Management System Frontend
const API_BASE = '/api';

// State management
const state = {
  classes: [],
  students: [],
  attendance: [],
  assignments: [],
  grades: [],
  currentClass: null,
  currentAssignment: null
};

// UI helpers: loading and toasts
function showLoading() {
  const el = document.getElementById('global-loader');
  if (el) { el.style.display = 'flex'; el.setAttribute('aria-hidden','false'); }
}

function hideLoading() {
  const el = document.getElementById('global-loader');
  if (el) { el.style.display = 'none'; el.setAttribute('aria-hidden','true'); }
}

function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = message;
  container.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 300);
  }, duration);
}

function showError(message) {
  showToast(message, 'error', 5000);
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  initAuth();
  setupEventListeners();
});

function initAuth() {
  const token = localStorage.getItem('tms_token');
  const overlay = document.getElementById('login-overlay');
  if (token) {
    // hide overlay and load app
    if (overlay) overlay.style.display = 'none';
    document.body.classList.remove('login-active');
    // populate user info from /me
    apiCall('GET', '/me').then(profile => {
      if (profile && profile.name) {
        document.getElementById('user-display').textContent = profile.name;
        document.getElementById('sidebar-username').textContent = profile.name;
        document.getElementById('sidebar-user-role').textContent = profile.school || '';
        document.getElementById('sidebar-avatar').textContent = (profile.name || 'T').charAt(0).toUpperCase();
      } else {
        document.getElementById('user-display').textContent = 'Signed in';
      }
    }).catch(() => { document.getElementById('user-display').textContent = 'Signed in'; });
    document.getElementById('btn-login').style.display = 'none';
    document.getElementById('btn-logout').style.display = 'inline-block';
    loadDashboard();
  } else {
    if (overlay) overlay.style.display = 'flex';
    // add class to make background blue and hide main UI
    document.body.classList.add('login-active');
  }

  document.getElementById('login-submit')?.addEventListener('click', () => {
    const u = document.getElementById('login-username').value;
    const p = document.getElementById('login-password').value;
    if (!u || !p) { showError('Enter username and password'); return; }
    apiCall('POST', '/auth/login', { username: u, password: p }).then(res => {
      if (res && res.token) {
          localStorage.setItem('tms_token', res.token);
          if (overlay) overlay.style.display = 'none';
          // remove the login-active state so main UI shows
          document.body.classList.remove('login-active');
          const name = res.teacher.name || res.teacher.username;
          document.getElementById('user-display').textContent = name;
          document.getElementById('sidebar-username').textContent = name;
          document.getElementById('sidebar-user-role').textContent = res.teacher.school || '';
          document.getElementById('sidebar-avatar').textContent = (name || 'T').charAt(0).toUpperCase();
          document.getElementById('btn-login').style.display = 'none';
          document.getElementById('btn-logout').style.display = 'inline-block';
          loadDashboard();
        } else {
          showError('Login failed');
        }
    });
  });

  document.getElementById('open-request')?.addEventListener('click', openAccountModal);
}

// Page Navigation
function setupNavigation() {
  document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navigateToPage(item.dataset.page);
    });
  });
}

function navigateToPage(pageName) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
  // Show selected page
  const page = document.getElementById(pageName);
  if (page) {
    page.classList.add('active');
    document.getElementById('page-title').textContent = getPageTitle(pageName);
  }
  // Update menu active state
  document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
  const menuItem = document.querySelector(`[data-page="${pageName}"]`);
  if (menuItem) menuItem.classList.add('active');

  // Load page specific data
  loadPageData(pageName);
}

function getPageTitle(page) {
  const titles = {
    dashboard: 'Dashboard',
    classes: 'My Classes',
    students: 'Students',
    attendance: 'Mark Attendance',
    assignments: 'Assignments',
    gradebook: 'Gradebook',
    analytics: 'Analytics',
    resources: 'Learning Resources',
    communications: 'Messages & Announcements',
    meetings: 'Parent-Teacher Meetings',
    'request-account': 'Request Account'
  };
  return titles[page] || 'Dashboard';
}

// API Functions
async function apiCall(method, endpoint, data = null) {
  showLoading();
  try {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (data) options.body = JSON.stringify(data);

    // Attach auth token if present
    const token = localStorage.getItem('tms_token');
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE}${endpoint}`, options);
    if (!response.ok) {
      const text = await response.text().catch(() => null);
      const msg = text || `HTTP ${response.status}`;
      throw new Error(msg);
    }
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    showError(error.message || 'Network error');
    return null;
  } finally {
    hideLoading();
  }
}

// Authentication helpers
function showLoginUI() {
  const name = prompt('Username:');
  const pass = prompt('Password:');
  if (!name || !pass) return;
  apiCall('POST', '/auth/login', { username: name, password: pass }).then(res => {
    if (res && res.token) {
      localStorage.setItem('tms_token', res.token);
      document.getElementById('user-display').textContent = res.teacher.name || res.teacher.username;
      document.getElementById('btn-login').style.display = 'none';
      document.getElementById('btn-logout').style.display = 'inline-block';
        showToast('Logged in successfully', 'success');
      loadDashboard();
    } else {
        showError('Login failed');
    }
  });
}

function logout() {
  localStorage.removeItem('tms_token');
  document.getElementById('user-display').textContent = 'Not signed in';
  document.getElementById('sidebar-username').textContent = 'Not signed in';
  document.getElementById('sidebar-user-role').textContent = 'Guest';
  document.getElementById('sidebar-avatar').textContent = 'T';
  document.getElementById('btn-login').style.display = 'inline-block';
  document.getElementById('btn-logout').style.display = 'none';
  // show login overlay and enforce blue background / hide main UI
  const overlay = document.getElementById('login-overlay');
  if (overlay) overlay.style.display = 'flex';
  document.body.classList.add('login-active');
}

// Account request modal handlers
function openAccountModal() {
  // Hide the login overlay and show the request-account page so the form is visible
  const overlay = document.getElementById('login-overlay');
  if (overlay) overlay.style.display = 'none';
  // Keep the blue background (login-active) so it still looks like a special screen
  document.body.classList.add('login-active');
  navigateToPage('request-account');
}

function closeAccountModal() {
  // If user is not authenticated, return to login overlay; otherwise go to dashboard
  const token = localStorage.getItem('tms_token');
  if (!token) {
    // show login overlay
    const overlay = document.getElementById('login-overlay');
    if (overlay) overlay.style.display = 'flex';
    // ensure request page is hidden
    const reqPage = document.getElementById('request-account');
    if (reqPage) reqPage.classList.remove('active');
    // keep login-active state
    document.body.classList.add('login-active');
    // show dashboard under the overlay (it will be hidden until login completes)
    navigateToPage('dashboard');
  } else {
    navigateToPage('dashboard');
  }
}

function submitAccountRequest() {
  const name = document.getElementById('req-name').value;
  const school = document.getElementById('req-school').value;
  const email = document.getElementById('req-email').value;
  const subjects = document.getElementById('req-subjects').value.split(',').map(s => s.trim()).filter(Boolean);
  if (!name || !school) { showError('Name and school are required'); return; }
  apiCall('POST', '/teacher-requests', { name, school, email, subjects }).then(res => {
    if (res) {
      showToast('Request submitted', 'success');
      // after submit, show login overlay
      const overlay = document.getElementById('login-overlay');
      if (overlay) overlay.style.display = 'flex';
      document.body.classList.add('login-active');
      navigateToPage('dashboard');
    }
  });
}

// Load Dashboard
async function loadDashboard() {
  state.classes = await apiCall('GET', '/classes') || [];
  state.students = await apiCall('GET', '/students') || [];
  state.attendance = await apiCall('GET', '/attendance') || [];
  state.assignments = await apiCall('GET', '/assignments') || [];

  document.getElementById('stat-classes').textContent = state.classes.length;
  document.getElementById('stat-students').textContent = state.students.length;
  document.getElementById('stat-assignments').textContent = state.assignments.length;

  if (state.students.length > 0) {
    const avgAttendance = Math.round((state.attendance.length / Math.max(state.students.length * 30, 1)) * 100);
    document.getElementById('stat-attendance').textContent = avgAttendance + '%';
  }
}

// Load Page Data
async function loadPageData(pageName) {
  try {
    switch(pageName) {
      case 'dashboard':
        await loadDashboard();
        break;
      case 'classes':
        await loadClasses();
        break;
      case 'students':
        await loadStudents();
        break;
      case 'attendance':
        await loadAttendancePage();
        break;
      case 'assignments':
        await loadAssignments();
        break;
      case 'gradebook':
        await loadGradebookPage();
        break;
      case 'analytics':
        await loadAnalytics();
        break;
      case 'resources':
        await loadResources();
        break;
      case 'communications':
        await loadCommunications();
        break;
      case 'meetings':
        await loadMeetings();
        break;
    }
  } catch (error) {
    console.error(`Error loading page ${pageName}:`, error);
  }
}

// Classes Management
async function loadClasses() {
  state.classes = await apiCall('GET', '/classes') || [];
  const tbody = document.getElementById('classes-tbody');
  tbody.innerHTML = '';

  state.classes.forEach(cls => {
    const studentCount = state.students.filter(s => s.classId === cls.id).length;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${cls.name}</td>
      <td>${cls.section}</td>
      <td>${cls.subject}</td>
      <td>${studentCount}</td>
      <td>
        <button class="btn btn-small" onclick="viewClass('${cls.id}')">View</button>
  <button class="btn btn-small" onclick="openConnectModal('${cls.id}')">Connect Student</button>
        <button class="btn btn-small" onclick="deleteClass('${cls.id}')">Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// Modal-based connect student flow
let _connectTargetClassId = null;
let _connectSelectedStudentId = null;

async function openConnectModal(classId) {
  _connectTargetClassId = classId;
  _connectSelectedStudentId = null;
  const modal = document.getElementById('connect-student-modal');
  const listEl = document.getElementById('connect-student-list');
  const classNameEl = document.getElementById('connect-modal-classname');
  classNameEl.textContent = '';
  listEl.innerHTML = '<p class="muted">Loading students...</p>';
  if (modal) modal.style.display = 'flex';

  // load students
  const students = await apiCall('GET', '/students') || [];
  if (!students.length) {
    listEl.innerHTML = '<p>No students available. Create a student first.</p>';
    return;
  }

  classNameEl.textContent = `Class ID: ${classId}`;
  listEl.innerHTML = '';
  students.forEach(s => {
    const row = document.createElement('div');
    row.className = 'student-row';
    row.dataset.studentId = s.id;
    row.innerHTML = `<strong>${s.name}</strong> <div class="muted">roll: ${s.rollNo || '—'} · class: ${s.classId || 'none'}</div>`;
    row.addEventListener('click', () => {
      document.querySelectorAll('#connect-student-list .student-row').forEach(r => r.classList.remove('selected'));
      row.classList.add('selected');
      _connectSelectedStudentId = s.id;
    });
    listEl.appendChild(row);
  });
}

async function closeConnectModal() {
  const modal = document.getElementById('connect-student-modal');
  if (modal) modal.style.display = 'none';
  _connectTargetClassId = null;
  _connectSelectedStudentId = null;
}

async function submitConnect() {
  if (!_connectTargetClassId) return showError('No target class');
  if (!_connectSelectedStudentId) return showError('Select a student first');
  const updated = await apiCall('PUT', `/students/${_connectSelectedStudentId}`, { classId: _connectTargetClassId });
  if (updated) {
    showToast('Student connected to class', 'success');
    closeConnectModal();
    loadClasses();
    loadStudents();
  } else {
    showError('Failed to connect student');
  }
}

// Wire modal buttons (safe guard in case DOM not ready when this script runs)
setTimeout(() => {
  document.getElementById('connect-cancel')?.addEventListener('click', closeConnectModal);
  document.getElementById('connect-submit')?.addEventListener('click', submitConnect);
}, 400);

async function createClass() {
  const name = prompt('Class Name:');
  const section = prompt('Section:');
  const subject = prompt('Subject:');
  
  if (name && section && subject) {
    const newClass = await apiCall('POST', '/classes', {
      name, section, subject, teacher: 'Current Teacher', capacity: 40
    });
    if (newClass) {
      loadClasses();
      showToast('Class created successfully!', 'success');
    }
  }
}

async function deleteClass(classId) {
  if (confirm('Delete this class?')) {
    await apiCall('DELETE', `/classes/${classId}`);
    loadClasses();
  }
}

// Students Management
async function loadStudents() {
  state.students = await apiCall('GET', '/students') || [];
  const tbody = document.getElementById('students-tbody');
  tbody.innerHTML = '';

  state.students.forEach(student => {
    const attendance = state.attendance.filter(a => a.studentId === student.id);
    const attendance_rate = attendance.length > 0
      ? Math.round((attendance.filter(a => a.status === 'present').length / attendance.length) * 100)
      : 0;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${student.name}</td>
      <td>${student.rollNo}</td>
      <td>${student.classId}</td>
      <td>${attendance_rate}%</td>
      <td>
        <button class="btn btn-small" onclick="viewStudent('${student.id}')">View</button>
        <button class="btn btn-small" onclick="deleteStudent('${student.id}')">Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

async function addStudent() {
  const classId = prompt('Class ID:');
  const name = prompt('Student Name:');
  const rollNo = prompt('Roll No:');
  const email = prompt('Email:');

  if (classId && name && rollNo && email) {
    const newStudent = await apiCall('POST', `/classes/${classId}/students`, {
      name, rollNo, email
    });
    if (newStudent) {
      loadStudents();
      alert('Student added successfully!');
    }
  }
}

async function deleteStudent(studentId) {
  if (confirm('Delete this student?')) {
    await apiCall('DELETE', `/students/${studentId}`);
    loadStudents();
  }
}

async function viewStudent(studentId) {
  const student = await apiCall('GET', `/students/${studentId}`);
  if (student) {
    alert(`
      Name: ${student.name}
      Attendance: ${student.attendance_rate}%
      Average Marks: ${student.avgMarks}
      Total Assignments: ${student.totalAssignments}
    `);
  }
}

// Attendance Management
async function loadAttendancePage() {
  state.classes = await apiCall('GET', '/classes') || [];
  const select = document.getElementById('attendance-class');
  select.innerHTML = '<option value="">Select Class</option>';

  state.classes.forEach(cls => {
    const option = document.createElement('option');
    option.value = cls.id;
    option.textContent = cls.name;
    select.appendChild(option);
  });

  // Use onchange assignment to avoid adding duplicate listeners on repeated calls
  select.onchange = loadAttendanceForm;
}

async function loadAttendanceForm(e) {
  const classId = e.target.value;
  if (!classId) return;
  state.students = await apiCall('GET', `/classes/${classId}/students`) || [];
  const tbody = document.getElementById('attendance-tbody');
  tbody.innerHTML = '';

  // Fetch today's attendance for this class to prefill values
  const today = new Date().toISOString().split('T')[0];
  const existing = await apiCall('GET', `/classes/${classId}/attendance?date=${today}`) || [];

  state.students.forEach(student => {
    const att = existing.find(a => a.studentId === student.id);
    const status = att ? att.status : 'present';
    const reason = att ? att.reason : '';

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${student.name}</td>
      <td>
        <select data-student-id="${student.id}" class="attendance-status">
          <option value="present" ${status==='present'? 'selected':''}>Present</option>
          <option value="absent" ${status==='absent'? 'selected':''}>Absent</option>
          <option value="late" ${status==='late'? 'selected':''}>Late</option>
          <option value="excused" ${status==='excused'? 'selected':''}>Excused</option>
        </select>
      </td>
      <td><input type="text" data-student-id="${student.id}" class="attendance-reason input" placeholder="Reason" value="${reason || ''}"></td>
    `;
    tbody.appendChild(row);
  });
}

async function saveAttendance() {
  const classId = document.getElementById('attendance-class').value;
  if (!classId) {
    alert('Please select a class');
    return;
  }

  const attendanceData = Array.from(document.querySelectorAll('.attendance-status')).map(select => ({
    studentId: select.dataset.studentId,
    status: select.value,
    reason: document.querySelector(`input[data-student-id="${select.dataset.studentId}"]`).value
  }));

  const result = await apiCall('POST', `/classes/${classId}/attendance`, {
    attendanceData,
    date: new Date().toISOString().split('T')[0]
  });

  if (result) {
    alert(`Attendance marked for ${result.marked} students`);
    // refresh dashboard stats and attendance state
    loadDashboard();
  }
}

// Assignments Management
async function loadAssignments() {
  state.assignments = await apiCall('GET', '/assignments') || [];
  // also fetch classes to show names instead of raw ids
  const classes = await apiCall('GET', '/classes') || [];
  const classMap = {};
  classes.forEach(c => classMap[c.id] = c.name || `${c.name} (${c.id})`);

  const tbody = document.getElementById('assignments-tbody');
  tbody.innerHTML = '';

  state.assignments.forEach(assignment => {
    const className = classMap[assignment.classId] || assignment.classId;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${assignment.title}</td>
      <td>${className}</td>
      <td>${assignment.dueDate}</td>
      <td>${assignment.submissions ? assignment.submissions.length : 0}</td>
      <td>
        <button class="btn btn-small" onclick="viewAssignment('${assignment.id}')">View</button>
        <button class="btn btn-small" style="margin-left:8px;" onclick="deleteAssignment('${assignment.id}')">Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

async function deleteAssignment(assignmentId) {
  if (!assignmentId) return;
  if (!confirm('Delete this assignment? This will also remove associated grades.')) return;
  const res = await apiCall('DELETE', `/assignments/${assignmentId}`);
  if (res && res.message) {
    await loadAssignments();
    // refresh gradebook/dashboard if open
    if (typeof loadDashboard === 'function') loadDashboard();
    alert('Assignment deleted');
  } else {
    // backend typically returns { message }
    await loadAssignments();
    alert('Assignment deleted');
  }
}

async function createAssignment() {
  // Open modal-based create form
  await openCreateAssignmentModal();
}

// Modal helpers for Create Assignment
async function openCreateAssignmentModal() {
  const modal = document.getElementById('create-assignment-modal');
  const classSelect = document.getElementById('ca-class');
  classSelect.innerHTML = '';

  const classes = await apiCall('GET', '/classes') || [];
  if (!classes.length) return alert('No classes available. Create a class first.');

  classes.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.name} (${c.section || ''})`;
    classSelect.appendChild(opt);
  });

  // reset fields
  document.getElementById('ca-title').value = '';
  document.getElementById('ca-desc').value = '';
  document.getElementById('ca-due').value = '';
  document.getElementById('ca-total').value = 100;

  modal.style.display = 'flex';
}

function closeCreateAssignmentModal() {
  const modal = document.getElementById('create-assignment-modal');
  modal.style.display = 'none';
}

async function submitCreateAssignmentModal() {
  const classId = document.getElementById('ca-class').value;
  const title = document.getElementById('ca-title').value.trim();
  const description = document.getElementById('ca-desc').value.trim();
  const dueDate = document.getElementById('ca-due').value.trim();
  const totalMarks = parseInt(document.getElementById('ca-total').value) || 100;

  if (!classId || !title || !dueDate) {
    return alert('Please fill class, title and due date');
  }

  const resp = await apiCall('POST', `/classes/${classId}/assignments`, {
    title, description, dueDate, totalMarks
  });

  if (resp) {
    await loadAssignments();
    closeCreateAssignmentModal();
    alert(`Assignment created and ${resp.createdGrades || 0} grade placeholders initialized.`);
  } else {
    alert('Failed to create assignment');
  }
}

// Gradebook Management
async function loadGradebookPage() {
  state.classes = await apiCall('GET', '/classes') || [];
  const select = document.getElementById('gradebook-class');
  select.innerHTML = '<option value="">Select Class</option>';

  state.classes.forEach(cls => {
    const option = document.createElement('option');
    option.value = cls.id;
    option.textContent = cls.name;
    select.appendChild(option);
  });

  // assign onchange directly to avoid duplicate listeners
  select.onchange = loadGradebookForm;
}

async function loadGradebookForm(e) {
  const classId = e.target.value;
  if (!classId) return;

  state.students = await apiCall('GET', `/classes/${classId}/students`) || [];
  state.assignments = await apiCall('GET', `/classes/${classId}/assignments`) || [];

  const assignmentSelect = document.getElementById('gradebook-assignment');
  assignmentSelect.innerHTML = '<option value="">Select Assignment</option>';
  state.assignments.forEach(a => {
    const option = document.createElement('option');
    option.value = a.id;
    option.textContent = a.title;
    assignmentSelect.appendChild(option);
  });

  // set onchange safely
  assignmentSelect.onchange = async () => {
    const assignmentId = assignmentSelect.value;
    if (assignmentId) await loadGradesList(classId, assignmentId);
  };
}

async function loadGradesList(classId, assignmentId) {
  const tbody = document.getElementById('gradebook-tbody');
  tbody.innerHTML = '';

  // load existing grades for this class
  const grades = await apiCall('GET', `/classes/${classId}/grades`) || [];
  // build a lookup for existing grade by student for this assignment
  const existingMap = {};
  grades.forEach(g => {
    if (g.assignmentId === assignmentId) existingMap[g.studentId] = g;
  });

  state.currentGrades = existingMap;

  state.students.forEach(student => {
    const existing = existingMap[student.id];
    const marksVal = existing ? existing.marksObtained : '';
    const feedbackVal = existing ? existing.feedback : '';

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${student.name}</td>
      <td><input type="number" min="0" max="100" class="marks-input input" data-student-id="${student.id}" placeholder="Marks" value="${marksVal}"></td>
      <td><input type="text" class="feedback-input input" data-student-id="${student.id}" placeholder="Feedback" value="${feedbackVal}"></td>
    `;
    tbody.appendChild(row);
  });
}

async function saveGrades() {
  const classId = document.getElementById('gradebook-class').value;
  const assignmentId = document.getElementById('gradebook-assignment').value;

  if (!classId || !assignmentId) {
    showError('Please select class and assignment');
    return;
  }

  const saves = [];
  for (const input of document.querySelectorAll('.marks-input')) {
    const studentId = input.dataset.studentId;
    const marks = parseInt(input.value);
    const feedbackEl = document.querySelector(`.feedback-input[data-student-id="${studentId}"]`);
    const feedback = feedbackEl ? feedbackEl.value : '';

    // only save when a numeric mark is provided
    if (!Number.isNaN(marks) && marks >= 0) {
      const existing = state.currentGrades && state.currentGrades[studentId];
      if (existing && existing.id) {
        // update existing grade
        const p = apiCall('PUT', `/grades/${existing.id}`, {
          classId, studentId, assignmentId, marksObtained: marks, feedback
        });
        saves.push(p);
      } else {
        // create new grade
        const p = apiCall('POST', '/grades', {
          classId, studentId, assignmentId, marksObtained: marks, feedback
        });
        saves.push(p);
      }
    }
  }

  // wait for all save requests
  await Promise.all(saves);

  // refresh the list and dashboard
  await loadGradesList(classId, assignmentId);
  if (typeof loadDashboard === 'function') await loadDashboard();

  showToast('Grades saved successfully!', 'success');
}

// Analytics
async function loadAnalytics() {
  // ensure we have classes loaded
  if (!state.classes.length) await loadDashboard();

  const classSelect = document.getElementById('analytics-class-select');
  // populate select
  if (classSelect) {
    classSelect.innerHTML = '';
    state.classes.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.name} ${c.section ? '('+c.section+')' : ''}`;
      classSelect.appendChild(opt);
    });
  }

  const chosenClassId = classSelect ? classSelect.value || state.classes[0]?.id : state.classes[0]?.id;
  if (!chosenClassId) return;

  const analytics = await apiCall('GET', `/classes/${chosenClassId}/analytics`);
  if (analytics) {
    // Top performers
    const topPerformersDiv = document.getElementById('top-performers');
    topPerformersDiv.innerHTML = analytics.topPerformers
      .map(p => `<div class="card"><strong>${p.name}</strong><br/>Avg: ${p.average}%</div>`)
      .join('');

    // Weak topics
    const weakTopicsDiv = document.getElementById('weak-topics');
    weakTopicsDiv.innerHTML = analytics.weakestTopics
      .map(t => `<div class="card"><strong>${t.topic}</strong><br/>Avg: ${t.average}%</div>`)
      .join('');

  // display overall average
  const overallEl = document.getElementById('analytics-overall');
  if (overallEl) overallEl.textContent = `Avg: ${analytics.overallAverage || 0}%`;

  // Overall class average - draw chart
  const perfCanvas = document.getElementById('performance-chart');
    if (perfCanvas && perfCanvas.getContext) {
      // draw simple bar chart for student averages
      const ctx = perfCanvas.getContext('2d');
      const students = analytics.studentAverages || [];
      const labels = students.map(s => s.name);
      const values = students.map(s => s.average);

      // responsive canvas size
      const width = Math.min(900, Math.max(600, labels.length * 50));
      const height = 300;
      perfCanvas.width = width;
      perfCanvas.height = height;

      // clear
      ctx.clearRect(0, 0, width, height);
      // background
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);

      const padding = 40;
      const chartWidth = width - padding * 2;
      const chartHeight = height - padding * 2;

      const maxVal = 100; // percent scale
      const barWidth = Math.max(12, chartWidth / Math.max(1, labels.length) - 8);

      // draw y axis lines
      ctx.strokeStyle = '#eee';
      ctx.fillStyle = '#666';
      ctx.font = '12px sans-serif';
      for (let i = 0; i <= 5; i++) {
        const y = padding + (chartHeight * i) / 5;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(padding + chartWidth, y);
        ctx.stroke();
        const label = Math.round((1 - i / 5) * maxVal);
        ctx.fillText(label + '%', 6, y + 4);
      }

      // draw bars
      students.forEach((s, idx) => {
        const val = values[idx] || 0;
        const x = padding + idx * (barWidth + 8) + 8;
        const h = (val / maxVal) * chartHeight;
        const y = padding + chartHeight - h;

        // bar
        ctx.fillStyle = 'rgba(102,126,234,0.9)';
        ctx.fillRect(x, y, barWidth, h);

        // value label
        ctx.fillStyle = '#333';
        ctx.font = '11px sans-serif';
        ctx.fillText(val + '%', x, y - 6);

        // x label (rotate if necessary)
        ctx.save();
        ctx.translate(x + barWidth / 2, padding + chartHeight + 14);
        ctx.rotate(-Math.PI / 6);
        ctx.textAlign = 'right';
        ctx.fillText(labels[idx], 0, 0);
        ctx.restore();
      });
    }
  }

  // wire change handler for class selection
  const classSelectEl = document.getElementById('analytics-class-select');
  if (classSelectEl) {
    classSelectEl.onchange = async () => {
      // update state and reload
      await loadAnalytics();
    };
  }
}

// Resources Management
async function loadResources() {
  const resources = await apiCall('GET', '/resources') || [];
  const container = document.getElementById('resources-list');

  if (container) {
    container.innerHTML = '';
    resources.forEach(resource => {
      const card = document.createElement('div');
      card.className = 'card';
      card.style.marginBottom = '12px';
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
          <div>
            <strong>${resource.title}</strong><div class="muted">${resource.category || ''} · ${resource.type}</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <a class="btn" href="${resource.url}" target="_blank">Download</a>
            <button class="btn" onclick="deleteResource('${resource.id}')">Delete</button>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  }
}

async function deleteResource(resourceId) {
  if (confirm('Delete this resource?')) {
    await apiCall('DELETE', `/resources/${resourceId}`);
    loadResources();
  }
}

// Communications Management
async function loadCommunications() {
  const messages = await apiCall('GET', '/communications') || [];
  const container = document.getElementById('messages-list');

  if (container) {
    container.innerHTML = '';
    messages.forEach(msg => {
      const el = document.createElement('div');
      el.className = 'card';
      el.style.marginBottom = '8px';
      el.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:start;gap:12px;">
          <div>
            <strong>${msg.senderId || 'Teacher'}</strong>
            <div class="muted">${new Date(msg.sentAt || msg.sentAt).toLocaleString ? new Date(msg.sentAt || Date.now()).toLocaleString() : ''}</div>
            <p style="margin-top:8px;">${msg.message}</p>
          </div>
          <div>
            <button class="btn" onclick="deleteMessage('${msg.id}')">Delete</button>
          </div>
        </div>
      `;
      container.appendChild(el);
    });
  }
}

// send-message handler
async function sendMessage() {
  const text = document.getElementById('message-input')?.value;
  if (!text || !text.trim()) { showError('Enter a message'); return; }
  // For now send as anonymous teacher (frontend will not attach senderId). Backend will store message.
  const res = await apiCall('POST', '/messages', { senderId: 'teacher', receiverId: 'class', message: text, type: 'message' });
  if (res) {
    document.getElementById('message-input').value = '';
    loadCommunications();
  } else {
    showError('Failed to send message');
  }
}

// upload resource handler (simple prompt)
async function uploadResource() {
  const title = prompt('Resource title:');
  if (!title) return;
  const url = prompt('Resource URL:');
  if (!url) return;
  const category = prompt('Category (optional):');
  const type = prompt('Type (pdf,video,link):','pdf');
  const res = await apiCall('POST', '/resources', { title, url, category, type });
  if (res) {
    showToast('Resource uploaded', 'success');
    loadResources();
  } else showError('Failed to upload');
}

async function deleteMessage(messageId) {
  if (confirm('Delete this message?')) {
    const res = await apiCall('DELETE', `/communications/${messageId}`);
    if (res !== null) {
      showToast('Message deleted', 'success');
      loadCommunications();
    } else {
      showError('Failed to delete message');
    }
  }
}

// Meetings Management
async function loadMeetings() {
  const meetings = await apiCall('GET', '/meetings') || [];
  const tbody = document.getElementById('meetings-tbody');
  
  if (tbody) {
    tbody.innerHTML = '';
    if (!meetings || !meetings.length) {
      const row = document.createElement('tr');
      row.innerHTML = `<td colspan="5" class="muted">No meetings scheduled.</td>`;
      tbody.appendChild(row);
      return;
    }
    meetings.forEach(meeting => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${meeting.parentName}</td>
        <td>${meeting.studentName}</td>
        <td>${meeting.date}</td>
        <td>${meeting.status}</td>
        <td><button class="btn-delete" onclick="deleteMeeting('${meeting.id}')">Delete</button></td>
      `;
      tbody.appendChild(row);
    });
  }
}

async function deleteMeeting(meetingId) {
  if (confirm('Delete this meeting?')) {
    await apiCall('DELETE', `/meetings/${meetingId}`);
    loadMeetings();
  }
}

// Schedule Meeting modal helpers
async function openScheduleMeetingModal() {
  const modal = document.getElementById('schedule-meeting-modal');
  const classSelect = document.getElementById('sm-class');
  const studentSelect = document.getElementById('sm-student');
  classSelect.innerHTML = '';
  studentSelect.innerHTML = '';

  const classes = await apiCall('GET', '/classes') || [];
  if (!classes.length) return alert('No classes available. Create a class first.');
  classes.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.name} (${c.section || ''})`;
    classSelect.appendChild(opt);
  });

  // when class changes, load students
  classSelect.onchange = async () => {
    const cid = classSelect.value;
    const students = await apiCall('GET', `/classes/${cid}/students`) || [];
    studentSelect.innerHTML = '';
    students.forEach(s => {
      const so = document.createElement('option');
      so.value = s.id;
      so.textContent = s.name;
      studentSelect.appendChild(so);
    });
  };

  // trigger initial population
  if (classSelect.options.length) {
    classSelect.dispatchEvent(new Event('change'));
  }

  document.getElementById('sm-parent').value = '';
  document.getElementById('sm-date').value = '';
  modal.style.display = 'flex';
}

function closeScheduleMeetingModal() {
  const modal = document.getElementById('schedule-meeting-modal');
  modal.style.display = 'none';
}

async function submitScheduleMeetingModal() {
  const classId = document.getElementById('sm-class').value;
  const studentId = document.getElementById('sm-student').value;
  const parentName = document.getElementById('sm-parent').value.trim();
  const scheduledDate = document.getElementById('sm-date').value.trim();

  if (!classId || !studentId || !parentName || !scheduledDate) {
    return showError('Please fill all fields');
  }

  const resp = await apiCall('POST', `/classes/${classId}/meetings`, { studentId, parentName, scheduledDate });
  if (resp) {
    closeScheduleMeetingModal();
    await loadMeetings();
    showToast('Meeting scheduled', 'success');
  } else {
    showError('Failed to schedule meeting');
  }
}

// Event Listeners Setup
function setupEventListeners() {
  document.addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    if (!action) return;

    switch(action) {
      case 'new-class':
        createClass();
        break;
      case 'add-student':
        addStudent();
        break;
      case 'mark-attendance':
        navigateToPage('attendance');
        break;
      case 'schedule-meeting':
        openScheduleMeetingModal();
        break;
      case 'create-assignment':
        createAssignment();
        break;
      case 'upload-resource':
        uploadResource();
        break;
    }
  });

  document.getElementById('save-attendance')?.addEventListener('click', saveAttendance);
  document.getElementById('save-grades')?.addEventListener('click', saveGrades);

  // Create Assignment modal buttons
  document.getElementById('ca-submit')?.addEventListener('click', submitCreateAssignmentModal);
  document.getElementById('ca-cancel')?.addEventListener('click', closeCreateAssignmentModal);
  // Schedule meeting modal wiring
  document.getElementById('sm-submit')?.addEventListener('click', submitScheduleMeetingModal);
  document.getElementById('sm-cancel')?.addEventListener('click', closeScheduleMeetingModal);

  // Auth UI
  document.getElementById('btn-login')?.addEventListener('click', showLoginUI);
  document.getElementById('btn-logout')?.addEventListener('click', logout);

  // Communications / resources
  document.getElementById('send-message')?.addEventListener('click', sendMessage);

  // Account request modal
  document.getElementById('req-submit')?.addEventListener('click', submitAccountRequest);
  document.getElementById('req-cancel')?.addEventListener('click', closeAccountModal);
  document.getElementById('btn-login')?.addEventListener('dblclick', openAccountModal); // double-click to open request modal
}

// Auto-load dashboard on start
setTimeout(() => {
  navigateToPage('dashboard');
}, 500);
