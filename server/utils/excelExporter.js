const ExcelJS = require('exceljs');
const AppError = require('./AppError');

const COLUMN_DEFINITIONS = {
  sno: { header: 'S.No', key: 'sno', width: 8 },
  rollNumber: { header: 'Roll Number', key: 'rollNumber', width: 15 },
  admissionId: { header: 'Admission ID', key: 'admissionId', width: 15 },
  studentName: { header: 'Student Name', key: 'studentName', width: 25 },
  school: { header: 'School', key: 'school', width: 20 },
  graduationYear: { header: 'Graduation Year', key: 'graduationYear', width: 15 },
  branch: { header: 'Branch', key: 'branch', width: 20 },
  cgpa: { header: 'CGPA', key: 'cgpa', width: 10 },
  tenthPercentage: { header: '10th %', key: 'tenthPercentage', width: 10 },
  twelfthPercentage: { header: '12th %', key: 'twelfthPercentage', width: 10 },
  collegeEmail: { header: 'College Email', key: 'collegeEmail', width: 30 },
  personalEmail: { header: 'Personal Email', key: 'personalEmail', width: 30 },
  mobileNumber: { header: 'Mobile Number', key: 'mobileNumber', width: 15 },
  gender: { header: 'Gender', key: 'gender', width: 12 },
  age: { header: 'Age', key: 'age', width: 10 },
  skills: { header: 'Skills', key: 'skills', width: 40 },
  status: { header: 'Status', key: 'status', width: 20 },
  currentRound: { header: 'Current Round', key: 'currentRound', width: 15 },
  appliedDate: { header: 'Applied Date', key: 'appliedDate', width: 20 },
  resumeExists: { header: 'Resume Uploaded', key: 'resumeExists', width: 18 },
  resumeLink: { header: 'Resume URL', key: 'resumeLink', width: 45 }
};

const MANDATORY_COLUMNS = ['sno', 'rollNumber', 'admissionId', 'studentName'];
const OPTIONAL_COLUMNS = Object.keys(COLUMN_DEFINITIONS).filter(key => !MANDATORY_COLUMNS.includes(key));
const OPTIONAL_COLUMN_SET = new Set(OPTIONAL_COLUMNS);

const formatStatus = (status, currentRoundName, isAbsent) => {
  if (status === 'selected') {
    return currentRoundName ? `Selected - ${currentRoundName}` : 'Selected';
  }
  if (status === 'rejected') {
    if (currentRoundName) {
      return `Rejected - ${currentRoundName}${isAbsent ? ' - Absent' : ''}`;
    }
    return `Rejected${isAbsent ? ' - Absent' : ''}`;
  }

  if (currentRoundName) {
    return `In Progress - ${currentRoundName}`;
  }
  return 'In Progress';
};

const sanitizeExcelValue = (value) => {
  if (typeof value === 'string' && /^[\s\uFEFF]*[=+\-@]/.test(value)) {
    return `'${value}`;
  }
  return value;
};

const generateExportWorkbook = async (dtos, requestedColumns = null, jobMetadata = { companyName: '', jobTitle: '' }) => {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PlaceHub';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Applicants', {
      views: [{ state: 'frozen', ySplit: 6 }],
      pageSetup: {
        paperSize: 9, // 9 = A4
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        printTitlesRow: '6:6'
      }
    });

    let validOptionalColumns = OPTIONAL_COLUMNS; // fallback

    if (Array.isArray(requestedColumns) && requestedColumns.length > 0) {
      // Filter out invalid keys and prevent mandatory duplicates in the optional list
      validOptionalColumns = requestedColumns.filter(c => OPTIONAL_COLUMN_SET.has(c));
    }

    const finalColumnKeys = [...MANDATORY_COLUMNS, ...validOptionalColumns];
    const finalColumns = finalColumnKeys.map(key => COLUMN_DEFINITIONS[key]);

    // Configure Columns (writes headers to Row 1 natively)
    worksheet.columns = finalColumns;

    // Shift headers to Row 6 by inserting 5 blank rows at the top
    worksheet.spliceRows(1, 0, [], [], [], [], []);

    // Build the Report Header Block
    worksheet.getCell('A1').value = 'PLACEHUB – APPLICANTS DETAILS';
    worksheet.mergeCells(1, 1, 1, finalColumns.length);
    worksheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FF1E3A8A' } };
    worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.getCell('A2').value = `Company Name : ${sanitizeExcelValue(jobMetadata.companyName)}`;
    worksheet.mergeCells(2, 1, 2, finalColumns.length);
    worksheet.getCell('A2').font = { bold: true };
    worksheet.getCell('A2').alignment = { horizontal: 'left', vertical: 'middle' };

    worksheet.getCell('A3').value = `Job Title : ${sanitizeExcelValue(jobMetadata.jobTitle)}`;
    worksheet.mergeCells(3, 1, 3, finalColumns.length);
    worksheet.getCell('A3').alignment = { horizontal: 'left', vertical: 'middle' };

    // Format Generated On timestamp in IST
    const generatedOnStr = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    }).replace(/\b(am|pm)\b/g, match => match.toUpperCase()) + ' IST';
    worksheet.getCell('A4').value = `Generated On : ${sanitizeExcelValue(generatedOnStr)}`;
    worksheet.mergeCells(4, 1, 4, finalColumns.length);
    worksheet.getCell('A4').alignment = { horizontal: 'left', vertical: 'middle' };

    // Explicit row heights for the metadata block
    worksheet.getRow(1).height = 24;
    worksheet.getRow(2).height = 20;
    worksheet.getRow(3).height = 20;
    worksheet.getRow(4).height = 20;
    worksheet.getRow(5).height = 10;

    // Style Header Row (now at Row 6)
    const headerRow = worksheet.getRow(6);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF2F2F2' }
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // Add Auto Filter for the range
    const firstDataRow = 7;
    const lastDataRow = firstDataRow + dtos.length - 1;

    if (dtos.length > 0) {
      worksheet.autoFilter = {
        from: { row: 6, column: 1 },
        to: { row: lastDataRow, column: finalColumns.length }
      };
    } else {
      worksheet.autoFilter = {
        from: { row: 6, column: 1 },
        to: { row: 6, column: finalColumns.length }
      };
    }

    // Add Data
    for (let i = 0; i < dtos.length; i++) {
      const dto = dtos[i];

      const rowData = {
        sno: i + 1,
        rollNumber: sanitizeExcelValue(dto.rollNumber),
        admissionId: sanitizeExcelValue(dto.admissionId),
        studentName: sanitizeExcelValue(dto.studentName),
        school: sanitizeExcelValue(dto.school),
        graduationYear: dto.graduationYear,
        branch: sanitizeExcelValue(dto.branch),
        cgpa: dto.cgpa,
        tenthPercentage: dto.tenthPercentage,
        twelfthPercentage: dto.twelfthPercentage,
        collegeEmail: sanitizeExcelValue(dto.collegeEmail),
        personalEmail: sanitizeExcelValue(dto.personalEmail),
        mobileNumber: sanitizeExcelValue(dto.mobileNumber),
        gender: sanitizeExcelValue(dto.gender),
        age: dto.age,
        skills: sanitizeExcelValue(Array.isArray(dto.skills) ? dto.skills.join(', ') : ''),
        status: sanitizeExcelValue(formatStatus(dto.status, dto.currentRoundName, dto.isAbsent)),
        currentRound: dto.currentRound,
        appliedDate: dto.appliedDate
          ? (() => {
            const d = new Date(dto.appliedDate);

            if (Number.isFinite(d.getTime())) {
              return d.toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
              }).replace(/\b(am|pm)\b/g, match => match.toUpperCase()) + ' IST';
            }

            return '';
          })()
          : '',
        resumeExists: dto.resumeExists ? 'Yes' : 'No',
        resumeLink: dto.resumeLink ? { text: 'View Resume', hyperlink: dto.resumeLink } : ''
      };

      const row = worksheet.addRow(rowData);

      // Style Row
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const colKey = worksheet.getColumn(colNumber).key || '';
        const isLeftAligned = ['collegeEmail', 'personalEmail', 'studentName', 'skills'].includes(colKey);

        cell.alignment = { 
          vertical: 'middle', 
          horizontal: isLeftAligned ? 'left' : 'center',
          wrapText: true 
        };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });

      if (dto.resumeLink) {
        const cell = row.getCell('resumeLink');

        cell.value = {
          text: 'View Resume',
          hyperlink: dto.resumeLink
        };

        cell.font = {
          ...cell.font,
          color: { argb: 'FF0563C1' },
          underline: true
        };

        cell.alignment = {
          horizontal: 'center',
          vertical: 'middle'
        };
      }
    }

    // Auto Column Width using a single pass over cells
    worksheet.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
        if (rowNumber < 6) return; // Prevent metadata rows from inflating column widths
        let columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      // Min 10, Max 50
      column.width = Math.max(10, Math.min(maxLength + 2, 50));
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;

  } catch (error) {
    throw new AppError('Failed to generate Excel workbook', 500);
  }
};

module.exports = {
  generateExportWorkbook
};
