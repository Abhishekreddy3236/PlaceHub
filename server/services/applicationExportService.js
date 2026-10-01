const User = require('../models/User');
const Application = require('../models/Application');
const Job = require('../models/Job');
const { applicationExportLimiter } = require('../utils/exportLimiter');
const { resolveRoundName } = require('../utils/applicationRoundResolver');
const {
  setupApplicationExportStream,
  writeStudentSectionHeader,
  writeApplicationHistoryRow,
  writeStudentSectionFooter
} = require('../utils/applicationExcelExporter');

const exportStudentApplications = async (req, res) => {
  if (!applicationExportLimiter.tryAcquire()) {
    res.status(429).json({
      success: false,
      message: 'Maximum concurrent exports reached. Please try again later.'
    });
    return;
  }

  const d = new Date();
  const dateStr = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  const filename = `PlaceHub_ApplicationHistory_${dateStr}.xlsx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Accel-Buffering', 'no');

  let isAborted = false;
  let cursor = null;
  let workbookRef = null;

  req.on('close', () => {
    isAborted = true;
    if (cursor) {
      cursor.close().catch(console.error);
    }
  });

  try {
    const { schools, graduationYears, status, isAbsentOnly } = req.body;

    const studentMatch = { role: 'student', isDeleted: false };
    if (Array.isArray(schools) && schools.length > 0) {
      studentMatch.school = { $in: schools };
    }
    if (Array.isArray(graduationYears) && graduationYears.length > 0) {
      studentMatch.graduationYear = { $in: graduationYears };
    }

    const students = await User.find(studentMatch)
      .select('rollNumber admissionId email name personalEmail mobileNumber school graduationYear')
      .lean();

    const studentMap = new Map();
    const studentIds = [];
    for (const s of students) {
      studentMap.set(s._id.toString(), s);
      studentIds.push(s._id);
    }

    const exportOptions = {
      includePersonalEmail: req.body.includePersonalEmail === true,
      includeMobileNumber: req.body.includeMobileNumber === true,
      includeSalary: req.body.includeSalary === true,
      includeLocation: req.body.includeLocation === true,
      includeAppliedDate: req.body.includeAppliedDate === true
    };

    const { workbook, worksheet } = setupApplicationExportStream(res, { schools, graduationYears, status, isAbsentOnly }, exportOptions);
    workbookRef = workbook;

    const jobMap = new Map();

    const appQuery = { student: { $in: studentIds } };
    if (req.body.status) {
      appQuery.status = req.body.status;
      if (req.body.status === 'rejected' && req.body.isAbsentOnly) {
        appQuery['rejectionInfo.isAbsent'] = true;
      }
    }

    cursor = Application.find(appQuery)
      .sort({ student: 1, createdAt: -1 })
      .select('student jobId status currentRound createdAt rejectionInfo.isAbsent')
      .cursor({ batchSize: 500 });

    let currentStudentId = null;
    let studentApplicationCount = 0;
    let studentSectionNumber = 0;

    for await (const app of cursor) {
      if (isAborted) break;

      const studentIdStr = app.student.toString();
      const jobIdStr = app.jobId.toString();

      const student = studentMap.get(studentIdStr);
      if (!student) continue;

      let job = jobMap.get(jobIdStr);
      if (!job) {
        job = await Job.findById(app.jobId)
          .select('title company companyId rounds salary location')
          .populate('companyId', 'name')
          .lean();

        if (job) {
          job.companyName = job.companyId?.name || job.company || 'N/A';
        }
        jobMap.set(jobIdStr, job || { companyName: 'N/A', title: 'N/A' });
      }

      const resolvedRoundName = resolveRoundName(app.currentRound, job);

      if (currentStudentId !== studentIdStr) {
        if (currentStudentId !== null) {
          writeStudentSectionFooter(worksheet, studentApplicationCount);
        }

        currentStudentId = studentIdStr;
        studentApplicationCount = 0;
        studentSectionNumber++;

        writeStudentSectionHeader(worksheet, student, studentSectionNumber, exportOptions);
      }

      studentApplicationCount++;
      writeApplicationHistoryRow(worksheet, app, job, resolvedRoundName, exportOptions);
    }

    if (!isAborted && currentStudentId !== null) {
      writeStudentSectionFooter(worksheet, studentApplicationCount);
    }

    if (!isAborted && workbookRef) {
      await workbookRef.commit();
    }
  } catch (error) {
    console.error('Application streaming export failed:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Export failed' });
    } else {
      res.end();
    }
  } finally {
    applicationExportLimiter.release();
    if (cursor && !cursor.closed) {
      cursor.close().catch(console.error);
    }
  }
};

module.exports = {
  exportStudentApplications
};
