// Database models using in-memory storage (can be replaced with MongoDB/PostgreSQL)
const db = {
  classes: [],
  students: [],
  attendance: [],
  assignments: [],
  grades: [],
  communications: [],
  resources: [],
  participationLog: [],
  meetings: [],
  timetable: [],
  teachers: [],
  teacherRequests: [],
  sessions: {}
};

// Utility ID generator
const generateId = () => require('crypto').randomBytes(8).toString('hex');

// Class Model
class Class {
  constructor(id, name, section, subject, teacher, capacity = 40) {
    this.id = id;
    this.name = name;
    this.section = section;
    this.subject = subject;
    this.teacher = teacher;
    this.capacity = capacity;
    this.createdAt = new Date();
  }
}

// Student Model
class Student {
  constructor(id, name, rollNo, classId, email, phone = '', notes = '') {
    this.id = id;
    this.name = name;
    this.rollNo = rollNo;
    this.classId = classId;
    this.email = email;
    this.phone = phone;
    this.notes = notes;
    this.enrolledAt = new Date();
  }
}

// Attendance Model
class Attendance {
  constructor(id, classId, studentId, date, status = 'present', reason = '') {
    this.id = id;
    this.classId = classId;
    this.studentId = studentId;
    this.date = date;
    this.status = status; // present, absent, late, excused
    this.reason = reason;
    this.recordedAt = new Date();
  }
}

// Assignment Model
class Assignment {
  constructor(id, classId, title, description, dueDate, totalMarks = 100) {
    this.id = id;
    this.classId = classId;
    this.title = title;
    this.description = description;
    this.dueDate = dueDate;
    this.totalMarks = totalMarks;
    this.type = 'assignment'; // assignment, quiz
    this.submissions = [];
    this.createdAt = new Date();
  }
}

// Grade Model
class Grade {
  constructor(id, classId, studentId, assignmentId, marksObtained, feedback = '') {
    this.id = id;
    this.classId = classId;
    this.studentId = studentId;
    this.assignmentId = assignmentId;
    this.marksObtained = marksObtained;
    this.feedback = feedback;
    this.gradedAt = new Date();
  }
}

// Communication Model
class Communication {
  constructor(id, senderId, receiverId, message, type = 'message') {
    this.id = id;
    this.senderId = senderId;
    this.receiverId = receiverId;
    this.message = message;
    this.type = type; // message, announcement, reminder
    this.read = false;
    this.sentAt = new Date();
  }
}

// Resource Model
class Resource {
  constructor(id, classId, title, category, url, type = 'pdf') {
    this.id = id;
    this.classId = classId;
    this.title = title;
    this.category = category;
    this.url = url;
    this.type = type; // pdf, doc, video, link
    this.uploadedAt = new Date();
  }
}

// Participation Log Model
class ParticipationLog {
  constructor(id, classId, studentId, date, level = 'active', notes = '') {
    this.id = id;
    this.classId = classId;
    this.studentId = studentId;
    this.date = date;
    this.level = level; // active, distracted, improvement needed
    this.notes = notes;
    this.recordedAt = new Date();
  }
}

// Meeting Model
class Meeting {
  constructor(id, classId, studentId, parentName, scheduledDate, status = 'scheduled') {
    this.id = id;
    this.classId = classId;
    this.studentId = studentId;
    this.parentName = parentName;
    this.scheduledDate = scheduledDate;
    this.status = status; // scheduled, completed, cancelled
    this.notes = '';
    this.createdAt = new Date();
  }
}

// Teacher Model
class Teacher {
  constructor(id, username, passwordHash, name, school = '', subjects = []) {
    this.id = id;
    this.username = username;
    this.passwordHash = passwordHash; // store hashed password
    this.name = name;
    this.school = school;
    this.subjects = subjects;
    this.createdAt = new Date();
  }
}

// Persistence helpers: load/save db to data.json
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const DATA_FILE = path.join(__dirname, '..', 'backend-data.json');

function loadDb() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      // merge known keys
      Object.keys(db).forEach(k => {
        if (parsed[k] !== undefined) db[k] = parsed[k];
      });
      console.log('Loaded db from', DATA_FILE);
    }
  } catch (e) {
    console.error('Failed to load DB file:', e && e.message);
  }
}

function saveDb() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save DB file:', e && e.message);
  }
}

// Auto-save every 3 seconds
loadDb();
setInterval(saveDb, 3000);

// Save on exit
process.on('exit', () => saveDb());
process.on('SIGINT', () => { saveDb(); process.exit(); });

// Seed an initial admin teacher and some sample data if DB empty
function hashPassword(pwd) { return crypto.createHash('sha256').update(pwd).digest('hex'); }
if (!db.teachers || db.teachers.length === 0) {
  const admin = new Teacher(generateId(), 'admin', hashPassword('admin123'), 'Administrator', 'Central School', ['Admin']);
  db.teachers.push(admin);
  // sample class and student
  const sampleClass = new Class(generateId(), 'Sample Class', 'A', 'Mathematics', admin.id, 30);
  db.classes.push(sampleClass);
  const s1 = new Student(generateId(), 'Alice Johnson', 'S001', sampleClass.id, 'alice@example.com');
  const s2 = new Student(generateId(), 'Bob Smith', 'S002', sampleClass.id, 'bob@example.com');
  db.students.push(s1, s2);
  saveDb();
  console.log('Seeded admin and sample data (username: admin / password: admin123)');
}

module.exports = {
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
  ,Teacher
};
