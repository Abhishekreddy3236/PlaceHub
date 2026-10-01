const ExcelJS = require('exceljs');
const AppError = require('./AppError');

// Mandatory columns that must appear first, in exact order
const MANDATORY_COLUMNS = [
  { header: 'S.No', key: 'sno', width: 8 },
  { header: 'Student Roll Number', key: 'rollNumber', width: 20 },
  { header: 'Student Admission ID', key: 'admissionId', width: 20 },
  { header: 'College Email', key: 'email', width: 30 },
  { header: 'Student Name', key: 'name', width: 25 },
];

// Mapping of all allowed optional columns
const OPTIONAL_COLUMNS_MAP = {
  school: { header: 'School', key: 'school', width: 20 },
  graduationYear: { header: 'Graduation Year', key: 'graduationYear', width: 15 },
  branch: { header: 'Branch', key: 'branch', width: 20 },
  cgpa: { header: 'CGPA', key: 'cgpa', width: 10 },
  tenthPercentage: { header: '10th Percentage', key: 'tenthPercentage', width: 15 },
  twelfthPercentage: { header: '12th Percentage', key: 'twelfthPercentage', width: 15 },
  personalEmail: { header: 'Personal Email', key: 'personalEmail', width: 30 },
  mobileNumber: { header: 'Mobile Number', key: 'mobileNumber', width: 15 },
  gender: { header: 'Gender', key: 'gender', width: 12 },
  age: { header: 'Age', key: 'age', width: 10 },
  skills: { header: 'Skills', key: 'skills', width: 40 },
  createdAt: { header: 'Registered On', key: 'createdAt', width: 10 },
};

/**
 * Escapes potentially dangerous values to prevent Spreadsheet Formula Injection
 * (CSV/Excel Injection). Converts any string starting with =, +, -, or @ into text.
 */
const safeExcelValue = (value) => {
  if (value === null || value === undefined) return '';

  const strValue = String(value);
  if (/^[\s\uFEFF]*[=+\-@]/.test(strValue)) {
    return `'${strValue}`;
  }
  return strValue;
};

/**
 * Format a student object into a flat row object matching the Excel keys
 */
const formatStudentRow = (student, index) => {
  const row = {
    sno: index + 1,
    rollNumber: safeExcelValue(student.rollNumber),
    admissionId: safeExcelValue(student.admissionId),
    email: safeExcelValue(student.email),
    name: safeExcelValue(student.name),
  };

  // Optional fields
  if (student.school !== undefined) row.school = safeExcelValue(student.school);
  if (student.graduationYear !== undefined) row.graduationYear = student.graduationYear; // Safe as it's a number
  if (student.branch !== undefined) row.branch = safeExcelValue(student.branch);
  if (student.cgpa !== undefined) row.cgpa = student.cgpa;
  if (student.tenthPercentage !== undefined) row.tenthPercentage = student.tenthPercentage;
  if (student.twelfthPercentage !== undefined) row.twelfthPercentage = student.twelfthPercentage;
  if (student.personalEmail !== undefined) row.personalEmail = safeExcelValue(student.personalEmail);
  if (student.mobileNumber !== undefined) row.mobileNumber = safeExcelValue(student.mobileNumber);
  if (student.gender !== undefined) row.gender = safeExcelValue(student.gender);
  if (student.age !== undefined) row.age = student.age;

  if (Array.isArray(student.skills)) {
    row.skills = safeExcelValue(student.skills.join(', '));
  } else if (student.skills) {
    row.skills = safeExcelValue(student.skills);
  }

  if (student.createdAt) {
    const d = new Date(student.createdAt);

    if (Number.isFinite(d.getTime())) {
      row.createdAt = d.toLocaleString('en-IN', {
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
  }

  return row;
};

/**
 * Generates an Excel workbook buffer for Admin Student Export.
 *
 * @param {Array} students - Array of LIVE user objects (role: student)
 * @param {Array} selectedColumns - Array of string keys representing requested optional columns
 * @returns {Buffer} - Excel workbook buffer
 */
const generateStudentExportWorkbook = async (students, selectedColumns = [], filters = {}) => {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PlaceHub';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Students Data', {
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

    // 1. Build Final Column Definitions
    const columns = [...MANDATORY_COLUMNS];

    if (Array.isArray(selectedColumns)) {
      const addedKeys = new Set();
      for (const colKey of selectedColumns) {
        if (OPTIONAL_COLUMNS_MAP[colKey] && !addedKeys.has(colKey)) {
          columns.push(OPTIONAL_COLUMNS_MAP[colKey]);
          addedKeys.add(colKey);
        }
      }
    }

    worksheet.columns = columns;

    // Shift headers to Row 6 by inserting 5 blank rows at the top
    worksheet.spliceRows(1, 0, [], [], [], [], []);

    // Build the Report Header Block
    worksheet.getCell('A1').value = 'PLACEHUB – STUDENTS DETAILS';
    worksheet.mergeCells(1, 1, 1, columns.length);
    worksheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FF1E3A8A' } };
    worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.getCell('A2').value = 'College Name : Woxsen University';
    worksheet.mergeCells(2, 1, 2, columns.length);
    worksheet.getCell('A2').font = { bold: true };
    worksheet.getCell('A2').alignment = { horizontal: 'left', vertical: 'middle' };

    let filterText = 'Filters : All Students';
    const filterParts = [];
    if (Array.isArray(filters.schools) && filters.schools.length > 0) {
      filterParts.push(`School = ${filters.schools.join(', ')}`);
    }
    if (Array.isArray(filters.graduationYears) && filters.graduationYears.length > 0) {
      filterParts.push(`Graduation Year = ${filters.graduationYears.join(', ')}`);
    }
    if (filterParts.length > 0) {
      filterText = `Filters : ${filterParts.join(' | ')}`;
    }

    worksheet.getCell('A3').value = safeExcelValue(filterText);
    worksheet.mergeCells(3, 1, 3, columns.length);
    worksheet.getCell('A3').alignment = { horizontal: 'left', vertical: 'middle' };

    // Format Generated On timestamp in IST
    const generatedOnStr = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    }).replace(/\b(am|pm)\b/g, match => match.toUpperCase()) + ' IST';
    worksheet.getCell('A4').value = `Generated On : ${safeExcelValue(generatedOnStr)}`;
    worksheet.mergeCells(4, 1, 4, columns.length);
    worksheet.getCell('A4').alignment = { horizontal: 'left', vertical: 'middle' };

    // Explicit row heights for the metadata block
    worksheet.getRow(1).height = 24;
    worksheet.getRow(2).height = 20;
    worksheet.getRow(3).height = 20;
    worksheet.getRow(4).height = 20;
    worksheet.getRow(5).height = 10;

    // 2. Style Header Row (now at Row 6)
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

    // Auto filter applied to the exact dimensions of the headers
    const firstDataRow = 7;
    const lastDataRow = firstDataRow + students.length - 1;

    if (students.length > 0) {
      worksheet.autoFilter = {
        from: { row: 6, column: 1 },
        to: { row: lastDataRow, column: columns.length }
      };
    } else {
      worksheet.autoFilter = {
        from: { row: 6, column: 1 },
        to: { row: 6, column: columns.length }
      };
    }

    // 3. Add Rows (Single Pass)
    for (let i = 0; i < students.length; i++) {
      const rowData = formatStudentRow(students[i], i);
      const row = worksheet.addRow(rowData);

      // Simple formatting for plain text wrapping and borders
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const colKey = worksheet.getColumn(colNumber).key || '';
        const isLeftAligned = ['email', 'personalEmail', 'name', 'skills'].includes(colKey);

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

    // Write to memory buffer entirely
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;

  } catch (error) {
    throw new AppError('Failed to generate Students Excel workbook', 500);
  }
};

module.exports = {
  generateStudentExportWorkbook
};
