// Comprehensive API routes for Teacher Management System
const express = require('express');
const router = express.Router();
const {
  db,
  Class,
  Student,
  Attendance,
  Assignment,
  Grade,
  Communication,
  Resource,
  ParticipationLog,
  Meeting
} = require('./models');

// Utility function to generate IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

// ==================== CLASS MANAGEMENT ====================

// Get all classes
router.get('/classes', (req, res) => {
  res.json(db.classes);
});

// Create a class
router.post('/classes', (req, res) => {
  const { name, section, subject, teacher, capacity } = req.body;
  const newClass = new Class(generateId(), name, section, subject, teacher, capacity);
  db.classes.push(newClass);
  res.status(201).json(newClass);
});

// Get single class with stats
router.get('/classes/:id', (req, res) => {
  const cls = db.classes.find(c => c.id === req.params.id);
  if (!cls) return res.status(404).json({ error: 'Class not found' });

  const students = db.students.filter(s => s.classId === req.params.id);
  const totalAttendance = db.attendance.filter(a => a.classId === req.params.id).length;
  const avgAttendanceRate = students.length > 0 
    ? Math.round((totalAttendance / (students.length * 30)) * 100) 
    : 0;

  res.json({
    ...cls,
    studentCount: students.length,
    avgAttendanceRate,
    topStudent: students[0] || null
  });
});

// Update class
router.put('/classes/:id', (req, res) => {
  const cls = db.classes.find(c => c.id === req.params.id);
  if (!cls) return res.status(404).json({ error: 'Class not found' });
  Object.assign(cls, req.body);
  res.json(cls);
});

// Delete class
router.delete('/classes/:id', (req, res) => {
  db.classes = db.classes.filter(c => c.id !== req.params.id);
  res.json({ message: 'Class deleted' });
});

// ==================== STUDENT MANAGEMENT ====================

// Get all students
router.get('/students', (req, res) => {
  res.json(db.students);
});

// Get students by class
router.get('/classes/:classId/students', (req, res) => {
  const students = db.students.filter(s => s.classId === req.params.classId);
  res.json(students);
});

// Add student
router.post('/classes/:classId/students', (req, res) => {
  const { name, rollNo, email, phone, notes } = req.body;
  const newStudent = new Student(generateId(), name, rollNo, req.params.classId, email, phone || '', notes || '');
  db.students.push(newStudent);
  res.status(201).json(newStudent);
});

// Bulk import students (CSV)
router.post('/classes/:classId/students/import', (req, res) => {
  const { students } = req.body; // Array of { name, rollNo, email, phone }
  if (!Array.isArray(students)) {
    return res.status(400).json({ error: 'Students must be an array' });
  }
  const imported = students.map(s => {
    const newStudent = new Student(generateId(), s.name, s.rollNo, req.params.classId, s.email, s.phone || '');
    db.students.push(newStudent);
    return newStudent;
  });
  res.status(201).json({ imported: imported.length, students: imported });
});

// Get student profile
router.get('/students/:id', (req, res) => {
  const student = db.students.find(s => s.id === req.params.id);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  const attendance = db.attendance.filter(a => a.studentId === req.params.id);
  const grades = db.grades.filter(g => g.studentId === req.params.id);
  const attendance_rate = attendance.length > 0
    ? Math.round((attendance.filter(a => a.status === 'present').length / attendance.length) * 100)
    : 0;

  const avgMarks = grades.length > 0
    ? Math.round(grades.reduce((sum, g) => sum + g.marksObtained, 0) / grades.length)
    : 0;

  res.json({
    ...student,
    attendance_rate,
    avgMarks,
    totalAssignments: grades.length,
    attendanceRecords: attendance.slice(-10)
  });
});

// Update student
router.put('/students/:id', (req, res) => {
  const student = db.students.find(s => s.id === req.params.id);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  Object.assign(student, req.body);
  res.json(student);
});

// Delete student
router.delete('/students/:id', (req, res) => {
  const index = db.students.findIndex(s => s.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Student not found' });
  db.students.splice(index, 1);
  res.json({ message: 'Student deleted' });
});

// ==================== AUTH / TEACHER ACCOUNTS ====================
const crypto = require('crypto');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Teacher requests an account (create request)
router.post('/teacher-requests', (req, res) => {
  const { name, school, subjects, email } = req.body;
  if (!name || !school) return res.status(400).json({ error: 'Name and school required' });
  const request = { id: generateId(), name, school, subjects: subjects || [], email: email || '', createdAt: new Date() };
  db.teacherRequests.push(request);
  res.status(201).json({ message: 'Request submitted', request });
});

// Admin: list teacher requests
router.get('/admin/teacher-requests', (req, res) => {
  res.json(db.teacherRequests);
});

// Admin: create teacher account (generates username/password)
router.post('/admin/create-teacher', (req, res) => {
  const { name, school, subjects, username, password } = req.body;
  if (!username || !password || !name) return res.status(400).json({ error: 'username, password, name required' });
  const existing = db.teachers.find(t => t.username === username);
  if (existing) return res.status(409).json({ error: 'Username already exists' });
  const teacher = new (require('./models').Teacher || Object)(generateId(), username, hashPassword(password), name, school || '', subjects || []);
  db.teachers.push(teacher);
  res.status(201).json({ message: 'Teacher created', teacher: { id: teacher.id, username: teacher.username, name: teacher.name } });
});

// Teacher login (returns simple session token)
router.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  const teacher = db.teachers.find(t => t.username === username && t.passwordHash === hashPassword(password));
  if (!teacher) return res.status(401).json({ error: 'Invalid credentials' });
  const token = generateId();
  db.sessions[token] = { teacherId: teacher.id, createdAt: Date.now() };
  res.json({ token, teacher: { id: teacher.id, username: teacher.username, name: teacher.name } });
});

// Middleware to protect teacher routes
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Missing Authorization header' });
  const token = auth.replace('Bearer ', '');
  const session = db.sessions[token];
  if (!session) return res.status(401).json({ error: 'Invalid session' });
  req.teacherId = session.teacherId;
  next();
}

// Example protected route: get my profile
router.get('/me', authMiddleware, (req, res) => {
  const teacher = db.teachers.find(t => t.id === req.teacherId);
  if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
  res.json({ id: teacher.id, username: teacher.username, name: teacher.name, school: teacher.school, subjects: teacher.subjects });
});

// ==================== ATTENDANCE TRACKING ====================

// Get attendance by class and date
router.get('/classes/:classId/attendance', (req, res) => {
  const { date } = req.query;
  let attendance = db.attendance.filter(a => a.classId === req.params.classId);
  if (date) {
    attendance = attendance.filter(a => a.date === date);
  }
  res.json(attendance);
});

// Get all attendance records (convenience endpoint)
router.get('/attendance', (req, res) => {
  res.json(db.attendance);
});

// Mark attendance for multiple students
router.post('/classes/:classId/attendance', (req, res) => {
  const { attendanceData, date } = req.body; // [{ studentId, status, reason }]
  const marked = attendanceData.map(record => {
    const recDate = date || new Date().toISOString().split('T')[0];
    // check if an attendance record already exists for this student/class/date
    const existingIndex = db.attendance.findIndex(a => a.classId === req.params.classId && a.studentId === record.studentId && a.date === recDate);
    if (existingIndex !== -1) {
      // update existing
      const existing = db.attendance[existingIndex];
      existing.status = record.status;
      existing.reason = record.reason || '';
      existing.recordedAt = new Date();
      return existing;
    } else {
      const newAttendance = new Attendance(
        generateId(),
        req.params.classId,
        record.studentId,
        recDate,
        record.status,
        record.reason || ''
      );
      db.attendance.push(newAttendance);
      return newAttendance;
    }
  });
  res.status(201).json({ marked: marked.length, records: marked });
});

// Get attendance report for student
router.get('/students/:studentId/attendance-report', (req, res) => {
  const records = db.attendance.filter(a => a.studentId === req.params.studentId);
  const total = records.length;
  const present = records.filter(a => a.status === 'present').length;
  const absent = records.filter(a => a.status === 'absent').length;
  const late = records.filter(a => a.status === 'late').length;
  const excused = records.filter(a => a.status === 'excused').length;

  res.json({
    studentId: req.params.studentId,
    total,
    present,
    absent,
    late,
    excused,
    attendancePercentage: total > 0 ? Math.round((present / total) * 100) : 0,
    recentRecords: records.slice(-20)
  });
});

// ==================== ASSIGNMENT MANAGEMENT ====================

// Get all assignments
router.get('/assignments', (req, res) => {
  res.json(db.assignments);
});

// Get assignments for class
router.get('/classes/:classId/assignments', (req, res) => {
  const assignments = db.assignments.filter(a => a.classId === req.params.classId);
  res.json(assignments);
});

// Create assignment
router.post('/classes/:classId/assignments', (req, res) => {
  const { title, description, dueDate, totalMarks, type } = req.body;
  const newAssignment = new Assignment(generateId(), req.params.classId, title, description, dueDate, totalMarks || 100);
  if (type) newAssignment.type = type;
  db.assignments.push(newAssignment);

  // Create placeholder grade records for all students in this class so
  // the gradebook is connected to this assignment immediately.
  const studentsInClass = db.students.filter(s => s.classId === req.params.classId);
  studentsInClass.forEach(s => {
    const newGrade = new Grade(generateId(), req.params.classId, s.id, newAssignment.id, null, '');
    db.grades.push(newGrade);
  });

  res.status(201).json({ assignment: newAssignment, createdGrades: studentsInClass.length });
});

// Get single assignment
router.get('/assignments/:id', (req, res) => {
  const assignment = db.assignments.find(a => a.id === req.params.id);
  if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
  res.json(assignment);
});

// Update assignment
router.put('/assignments/:id', (req, res) => {
  const assignment = db.assignments.find(a => a.id === req.params.id);
  if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
  Object.assign(assignment, req.body);
  res.json(assignment);
});

// Submit assignment
router.post('/assignments/:id/submit', (req, res) => {
  const { studentId, content, fileUrl } = req.body;
  const assignment = db.assignments.find(a => a.id === req.params.id);
  if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

  assignment.submissions.push({
    studentId,
    content,
    fileUrl,
    submittedAt: new Date()
  });
  res.status(201).json({ message: 'Submission recorded', submission: assignment.submissions.slice(-1)[0] });
});

// Delete assignment
router.delete('/assignments/:id', (req, res) => {
  const index = db.assignments.findIndex(a => a.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Assignment not found' });
  const removed = db.assignments.splice(index, 1)[0];
  // remove grades associated with this assignment
  db.grades = db.grades.filter(g => g.assignmentId !== req.params.id);
  res.json({ message: 'Assignment deleted', assignment: removed });
});

// ==================== GRADEBOOK ====================

// Get grades for class
router.get('/classes/:classId/grades', (req, res) => {
  const grades = db.grades.filter(g => g.classId === req.params.classId);
  res.json(grades);
});

// Get grades for student
router.get('/students/:studentId/grades', (req, res) => {
  const grades = db.grades.filter(g => g.studentId === req.params.studentId);
  const avgMarks = grades.length > 0
    ? Math.round(grades.reduce((sum, g) => sum + g.marksObtained, 0) / grades.length)
    : 0;
  res.json({ grades, average: avgMarks });
});

// Enter marks with autosave
router.post('/grades', (req, res) => {
  const { classId, studentId, assignmentId, marksObtained, feedback } = req.body;
  const newGrade = new Grade(generateId(), classId, studentId, assignmentId, marksObtained, feedback);
  db.grades.push(newGrade);
  res.status(201).json(newGrade);
});

// Update grade
router.put('/grades/:id', (req, res) => {
  const grade = db.grades.find(g => g.id === req.params.id);
  if (!grade) return res.status(404).json({ error: 'Grade not found' });
  Object.assign(grade, req.body);
  res.json(grade);
});

// ==================== COMMUNICATION ====================

// Get all communications
router.get('/communications', (req, res) => {
  res.json(db.communications);
});

// Send message
router.post('/messages', (req, res) => {
  const { senderId, receiverId, message, type } = req.body;
  const newMessage = new Communication(generateId(), senderId, receiverId, message, type || 'message');
  db.communications.push(newMessage);
  res.status(201).json(newMessage);
});

// Get messages for user
router.get('/messages/:userId', (req, res) => {
  const messages = db.communications.filter(c =>
    c.receiverId === req.params.userId || c.senderId === req.params.userId
  );
  res.json(messages);
});

// Post announcement
router.post('/announcements', (req, res) => {
  const { senderId, classId, message } = req.body;
  const announcement = new Communication(generateId(), senderId, classId, message, 'announcement');
  db.communications.push(announcement);
  res.status(201).json(announcement);
});

// Get announcements for class
router.get('/classes/:classId/announcements', (req, res) => {
  const announcements = db.communications.filter(c =>
    c.type === 'announcement' && c.receiverId === req.params.classId
  );
  res.json(announcements);
});

// Delete message
router.delete('/communications/:id', (req, res) => {
  const index = db.communications.findIndex(c => c.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Communication not found' });
  db.communications.splice(index, 1);
  res.json({ message: 'Communication deleted' });
});

// ==================== RESOURCES ====================

// Get all resources
router.get('/resources', (req, res) => {
  res.json(db.resources);
});

// Get resources for class
router.get('/classes/:classId/resources', (req, res) => {
  const resources = db.resources.filter(r => r.classId === req.params.classId);
  res.json(resources);
});

// Upload resource
router.post('/resources', (req, res) => {
  const { classId, title, category, url, type } = req.body;
  const newResource = new Resource(generateId(), classId, title, category, url, type);
  db.resources.push(newResource);
  res.status(201).json(newResource);
});

// Upload resource to class
router.post('/classes/:classId/resources', (req, res) => {
  const { title, category, url, type } = req.body;
  const newResource = new Resource(generateId(), req.params.classId, title, category, url, type);
  db.resources.push(newResource);
  res.status(201).json(newResource);
});

// Get resource by ID
router.get('/resources/:id', (req, res) => {
  const resource = db.resources.find(r => r.id === req.params.id);
  if (!resource) return res.status(404).json({ error: 'Resource not found' });
  res.json(resource);
});

// Update resource
router.put('/resources/:id', (req, res) => {
  const resource = db.resources.find(r => r.id === req.params.id);
  if (!resource) return res.status(404).json({ error: 'Resource not found' });
  Object.assign(resource, req.body);
  res.json(resource);
});

// Delete resource
router.delete('/resources/:id', (req, res) => {
  const index = db.resources.findIndex(r => r.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Resource not found' });
  db.resources.splice(index, 1);
  res.json({ message: 'Resource deleted' });
});

// ==================== PARTICIPATION LOG ====================

// Log participation
router.post('/classes/:classId/participation', (req, res) => {
  const { studentId, date, level, notes } = req.body;
  const log = new ParticipationLog(generateId(), req.params.classId, studentId, date, level, notes);
  db.participationLog.push(log);
  res.status(201).json(log);
});

// Get participation for student
router.get('/students/:studentId/participation', (req, res) => {
  const logs = db.participationLog.filter(p => p.studentId === req.params.studentId);
  res.json(logs);
});

// ==================== PARENT MEETINGS ====================

// Get all meetings
router.get('/meetings', (req, res) => {
  res.json(db.meetings);
});

// Schedule parent meeting
router.post('/meetings', (req, res) => {
  const { classId, studentId, parentName, scheduledDate } = req.body;
  const meeting = new Meeting(generateId(), classId, studentId, parentName, scheduledDate);
  db.meetings.push(meeting);
  res.status(201).json(meeting);
});

// Schedule parent meeting for class
router.post('/classes/:classId/meetings', (req, res) => {
  const { studentId, parentName, scheduledDate } = req.body;
  const meeting = new Meeting(generateId(), req.params.classId, studentId, parentName, scheduledDate);
  db.meetings.push(meeting);
  res.status(201).json(meeting);
});

// Get meetings for class
router.get('/classes/:classId/meetings', (req, res) => {
  const meetings = db.meetings.filter(m => m.classId === req.params.classId);
  res.json(meetings);
});

// Get meeting by ID
router.get('/meetings/:id', (req, res) => {
  const meeting = db.meetings.find(m => m.id === req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
  res.json(meeting);
});

// Update meeting
router.put('/meetings/:id', (req, res) => {
  const meeting = db.meetings.find(m => m.id === req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
  Object.assign(meeting, req.body);
  res.json(meeting);
});

// Delete meeting
router.delete('/meetings/:id', (req, res) => {
  const index = db.meetings.findIndex(m => m.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Meeting not found' });
  db.meetings.splice(index, 1);
  res.json({ message: 'Meeting deleted' });
});

// ==================== ANALYTICS ====================

// Get class performance analytics
router.get('/classes/:classId/analytics', (req, res) => {
  const grades = db.grades.filter(g => g.classId === req.params.classId && typeof g.marksObtained === 'number');
  const students = db.students.filter(s => s.classId === req.params.classId);

  // per-student averages (ignore placeholder/null marks)
  const studentAverages = students.map(s => {
    const studentGrades = db.grades.filter(g => g.classId === req.params.classId && g.studentId === s.id && typeof g.marksObtained === 'number');
    const avg = studentGrades.length > 0
      ? studentGrades.reduce((sum, g) => sum + g.marksObtained, 0) / studentGrades.length
      : 0;
    return { id: s.id, name: s.name, average: Math.round(avg) };
  }).sort((a, b) => b.average - a.average);

  const topPerformers = studentAverages.slice(0, 5);

  // compute weakest topics using valid numeric marks only
  const weakTopics = {};
  db.grades.filter(g => g.classId === req.params.classId && typeof g.marksObtained === 'number').forEach(g => {
    const assignment = db.assignments.find(a => a.id === g.assignmentId);
    if (assignment) {
      if (!weakTopics[assignment.title]) weakTopics[assignment.title] = [];
      weakTopics[assignment.title].push(g.marksObtained);
    }
  });

  const avgByTopic = Object.entries(weakTopics).map(([topic, marks]) => ({
    topic,
    average: Math.round(marks.reduce((a, b) => a + b, 0) / marks.length)
  }));

  const overallAverage = grades.length > 0 ? Math.round(grades.reduce((sum, g) => sum + g.marksObtained, 0) / grades.length) : 0;

  res.json({
    classId: req.params.classId,
    studentCount: students.length,
    totalGrades: grades.length,
    studentAverages,
    topPerformers,
    weakestTopics: avgByTopic.sort((a, b) => a.average - b.average).slice(0, 5),
    overallAverage
  });
});

// Get weak topics for student
router.get('/students/:studentId/weak-topics', (req, res) => {
  const studentGrades = db.grades.filter(g => g.studentId === req.params.studentId);
  const topicPerformance = {};

  studentGrades.forEach(g => {
    const assignment = db.assignments.find(a => a.id === g.assignmentId);
    if (assignment) {
      if (!topicPerformance[assignment.title]) topicPerformance[assignment.title] = [];
      topicPerformance[assignment.title].push({
        marks: g.marksObtained,
        total: assignment.totalMarks,
        percentage: Math.round((g.marksObtained / assignment.totalMarks) * 100)
      });
    }
  });

  const weakTopics = Object.entries(topicPerformance)
    .map(([topic, performances]) => ({
      topic,
      average: Math.round(performances.reduce((sum, p) => sum + p.percentage, 0) / performances.length)
    }))
    .sort((a, b) => a.average - b.average)
    .slice(0, 5);

  res.json({ studentId: req.params.studentId, weakTopics });
});

// ==================== AI FEATURES ====================

// Generate AI suggestions for student improvement
router.get('/students/:studentId/ai-suggestions', (req, res) => {
  const weakTopics = db.grades
    .filter(g => g.studentId === req.params.studentId)
    .map(g => {
      const assignment = db.assignments.find(a => a.id === g.assignmentId);
      return {
        topic: assignment ? assignment.title : 'Unknown',
        percentage: Math.round((g.marksObtained / 100) * 100)
      };
    });

  const suggestions = weakTopics
    .filter(t => t.percentage < 70)
    .map(t => ({
      topic: t.topic,
      suggestion: `Consider reviewing ${t.topic}. Practice more problems and seek peer help.`,
      difficulty: t.percentage < 50 ? 'High' : 'Medium',
      recommendedResources: ['Video tutorials', 'Practice worksheets', 'Group study']
    }));

  res.json({ studentId: req.params.studentId, suggestions });
});

// Generate question paper
router.post('/generate-question-paper', (req, res) => {
  const { classId, numberOfQuestions, questionType } = req.body; // questionType: mcq, short-answer, mixed
  const questions = Array(numberOfQuestions).fill(null).map((_, i) => ({
    id: generateId(),
    question: `${questionType === 'mcq' ? '[MCQ] ' : ''}Sample Question ${i + 1}`,
    type: questionType,
    marks: questionType === 'mcq' ? 1 : 5,
    options: questionType === 'mcq' ? ['Option A', 'Option B', 'Option C', 'Option D'] : null
  }));

  res.json({
    paperId: generateId(),
    classId,
    totalMarks: questions.reduce((sum, q) => sum + q.marks, 0),
    questionCount: numberOfQuestions,
    questions
  });
});

// ==================== API DOCUMENTATION ====================
// A simple HTML page listing available endpoints. Visit GET /api to view.
router.get('/', (req, res) => {
  const html = `<!doctype html>
  <html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Teacher Management System - API Documentation</title>
    <style>
      body{font-family:Arial,Helvetica,sans-serif;margin:20px;color:#222}
      h1{color:#2c3e50}
      table{width:100%;border-collapse:collapse;margin-top:12px}
      th,td{border:1px solid #ddd;padding:8px;text-align:left}
      th{background:#f4f6fb}
      pre{background:#f8f8f8;padding:8px;border-radius:4px;overflow:auto}
      .muted{color:#666;font-size:0.9em}
    </style>
  </head>
  <body>
    <h1>Teacher Management System — API</h1>
    <p class="muted">Base path: <strong>/api</strong></p>
    <table>
      <thead><tr><th>Method</th><th>Endpoint</th><th>Description</th></tr></thead>
      <tbody>
        <tr><td>GET</td><td>/classes</td><td>List all classes</td></tr>
        <tr><td>POST</td><td>/classes</td><td>Create a class (body: name,section,subject,teacher,capacity)</td></tr>
        <tr><td>GET</td><td>/classes/:id</td><td>Get class details & stats</td></tr>
        <tr><td>PUT</td><td>/classes/:id</td><td>Update class</td></tr>
        <tr><td>DELETE</td><td>/classes/:id</td><td>Delete class</td></tr>

        <tr><td>GET</td><td>/students</td><td>List all students</td></tr>
        <tr><td>GET</td><td>/students/:id</td><td>Get student profile</td></tr>
        <tr><td>POST</td><td>/classes/:classId/students</td><td>Add student to class (body: name,rollNo,email,phone)</td></tr>
        <tr><td>POST</td><td>/classes/:classId/students/import</td><td>Bulk import students (body: students[])</td></tr>
        <tr><td>PUT</td><td>/students/:id</td><td>Update student</td></tr>
        <tr><td>DELETE</td><td>/students/:id</td><td>Delete student</td></tr>

        <tr><td>GET</td><td>/classes/:classId/attendance</td><td>Get attendance for class (query: date)</td></tr>
        <tr><td>POST</td><td>/classes/:classId/attendance</td><td>Mark attendance (body: attendanceData[], date)</td></tr>
        <tr><td>GET</td><td>/students/:studentId/attendance-report</td><td>Get attendance report for a student</td></tr>

        <tr><td>GET</td><td>/assignments</td><td>List all assignments</td></tr>
        <tr><td>GET</td><td>/classes/:classId/assignments</td><td>List assignments for a class</td></tr>
        <tr><td>POST</td><td>/classes/:classId/assignments</td><td>Create assignment (body: title,description,dueDate,totalMarks)</td></tr>
        <tr><td>GET</td><td>/assignments/:id</td><td>Get single assignment</td></tr>
        <tr><td>POST</td><td>/assignments/:id/submit</td><td>Submit assignment (body: studentId,content,fileUrl)</td></tr>
        <tr><td>DELETE</td><td>/assignments/:id</td><td>Delete assignment</td></tr>

        <tr><td>GET</td><td>/classes/:classId/grades</td><td>Get grades for class</td></tr>
        <tr><td>GET</td><td>/students/:studentId/grades</td><td>Get grades and average for a student</td></tr>
        <tr><td>POST</td><td>/grades</td><td>Enter a grade (body: classId,studentId,assignmentId,marksObtained,feedback)</td></tr>

        <tr><td>GET</td><td>/communications</td><td>Get all communications (messages & announcements)</td></tr>
        <tr><td>POST</td><td>/messages</td><td>Send message (body: senderId,receiverId,message,type)</td></tr>
        <tr><td>POST</td><td>/announcements</td><td>Post announcement (body: senderId,classId,message)</td></tr>
        <tr><td>DELETE</td><td>/communications/:id</td><td>Delete a communication</td></tr>

        <tr><td>GET</td><td>/resources</td><td>List all learning resources</td></tr>
        <tr><td>POST</td><td>/resources</td><td>Upload resource (body: classId,title,category,url,type)</td></tr>
        <tr><td>GET</td><td>/resources/:id</td><td>Get resource by id</td></tr>
        <tr><td>PUT</td><td>/resources/:id</td><td>Update resource</td></tr>
        <tr><td>DELETE</td><td>/resources/:id</td><td>Delete resource</td></tr>

        <tr><td>POST</td><td>/classes/:classId/participation</td><td>Log student participation</td></tr>

        <tr><td>GET</td><td>/meetings</td><td>List all meetings</td></tr>
        <tr><td>POST</td><td>/meetings</td><td>Schedule meeting (body: classId,studentId,parentName,scheduledDate)</td></tr>
        <tr><td>GET</td><td>/classes/:classId/meetings</td><td>Get meetings for a class</td></tr>
        <tr><td>PUT</td><td>/meetings/:id</td><td>Update meeting</td></tr>
        <tr><td>DELETE</td><td>/meetings/:id</td><td>Delete meeting</td></tr>

        <tr><td>GET</td><td>/classes/:classId/analytics</td><td>Get analytics for a class (top performers, weak topics)</td></tr>
        <tr><td>GET</td><td>/students/:studentId/weak-topics</td><td>Get weak topics for a student</td></tr>
        <tr><td>GET</td><td>/students/:studentId/ai-suggestions</td><td>AI-driven suggestions for improvement</td></tr>
        <tr><td>POST</td><td>/generate-question-paper</td><td>Generate question paper (body: classId,numberOfQuestions,questionType)</td></tr>
      </tbody>
    </table>

    <h2>Examples</h2>
    <pre>GET /api/classes
curl -X GET http://localhost:3000/api/classes</pre>

    <pre>POST /api/classes
curl -X POST http://localhost:3000/api/classes -H "Content-Type: application/json" -d '{"name":"Math 101","section":"A","subject":"Math","teacher":"Ms. Lee","capacity":30}'</pre>

    <p class="muted">This is a generated convenience page. For programmatic use prefer JSON endpoints under <code>/api/*</code>.</p>
  </body>
  </html>`;

  res.set('Content-Type', 'text/html');
  res.send(html);
});

// ==================== SWAGGER / OPENAPI JSON & UI ====================
// Machine-readable OpenAPI JSON available at /api/swagger.json
router.get('/swagger.json', (req, res) => {
  const openapi = {
    openapi: '3.0.0',
    info: {
      title: 'Teacher Management System API',
      version: '1.0.0',
      description: 'Auto-generated OpenAPI spec for the Teacher Management System'
    },
    servers: [{ url: '/api' }],
    paths: {
      '/classes': {
        get: { summary: 'List classes', responses: { '200': { description: 'OK' } } },
        post: { summary: 'Create class', requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '201': { description: 'Created' } } }
      },
      '/classes/{id}': {
        get: { summary: 'Get class', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' }, '404': { description: 'Not Found' } } },
        put: { summary: 'Update class' },
        delete: { summary: 'Delete class' }
      },
      '/students': { get: { summary: 'List students', responses: { '200': { description: 'OK' } } } },
      '/students/{id}': { get: { summary: 'Get student' } },
      '/classes/{classId}/students': { post: { summary: 'Add student' } },
      '/assignments': { get: { summary: 'List assignments' } },
      '/assignments/{id}/submit': { post: { summary: 'Submit assignment' } },
      '/grades': { post: { summary: 'Enter grade' } },
      '/communications': { get: { summary: 'List communications' } },
      '/resources': { get: { summary: 'List resources' }, post: { summary: 'Upload resource' } },
      '/meetings': { get: { summary: 'List meetings' }, post: { summary: 'Schedule meeting' } },
      '/classes/{classId}/analytics': { get: { summary: 'Get analytics for class' } }
    },
    components: {
      schemas: {
        Class: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } }
      }
    }
  };

  res.json(openapi);
});

// Serve Swagger UI (CDN) at /api/docs
router.get('/docs', (req, res) => {
  const ui = `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>API Docs - Swagger UI</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@4/swagger-ui.css" />
    <style>body{margin:0;padding:0}</style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@4/swagger-ui-bundle.js"></script>
    <script>
      window.onload = function() {
        const ui = SwaggerUIBundle({
          url: '/api/swagger.json',
          dom_id: '#swagger-ui',
          deepLinking: true,
          presets: [SwaggerUIBundle.presets.apis],
          layout: 'BaseLayout'
        });
        window.ui = ui;
      };
    </script>
  </body>
  </html>`;

  res.set('Content-Type', 'text/html');
  res.send(ui);
});

// Debug: inspect router before exporting
try {
  console.log('DEBUG routes: router type =', typeof router);
  console.log('DEBUG routes: router keys =', Object.keys(router));
} catch (e) {
  console.log('DEBUG routes inspect error', e && e.message);
}

module.exports = router;
