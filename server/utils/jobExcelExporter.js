const ExcelJS = require('exceljs');
const AppError = require('./AppError');

// Mandatory exact columns
const COLUMNS = [
  { header: 'S. No', key: 'sno', width: 8 },
  { header: 'Company Name', key: 'company', width: 50 },
  { header: 'Job Title', key: 'title', width: 50 },
  { header: 'Location', key: 'location', width: 45 },
  { header: 'Salary', key: 'salary', width: 30 },
  { header: 'School', key: 'school', width: 20 },
  { header: 'Year', key: 'year', width: 15 },
  { header: 'Applied', key: 'totalApplied', width: 15 },
  { header: 'In Progress', key: 'totalInProgress', width: 15 },
  { header: 'Selected', key: 'totalSelected', width: 15 },
  { header: 'Rejected', key: 'totalRejected', width: 15 },
];

const safeExcelValue = (value) => {
  if (value === null || value === undefined) return '';

  const strValue = String(value);
  if (/^[\s\uFEFF]*[=+\-@]/.test(strValue)) {
    return `'${strValue}`;
  }
  return strValue;
};

const formatJobRow = (job, counts, index) => {
  const row = {
    sno: index + 1,
    company: safeExcelValue(job.company),
    title: safeExcelValue(job.title),
    location: safeExcelValue(job.location),
    salary: safeExcelValue(job.salary),
  };

  if (Array.isArray(job.eligibleSchools) && job.eligibleSchools.length > 0) {
    row.school = safeExcelValue(job.eligibleSchools.join(', '));
  } else {
    row.school = 'All';
  }

  if (Array.isArray(job.graduationYears) && job.graduationYears.length > 0) {
    row.year = safeExcelValue(job.graduationYears.join(', '));
  } else {
    row.year = 'All';
  }

  row.totalApplied = counts.applied || 0;
  row.totalInProgress = counts.inProgress || 0;
  row.totalSelected = counts.selected || 0;
  row.totalRejected = counts.rejected || 0;

  return row;
};

/**
 * Generates an Excel workbook buffer for Admin Jobs Export.
 */
const generateJobExportWorkbook = async (jobs, countsMap, filters = {}) => {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PlaceHub';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Jobs Data', {
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

    worksheet.columns = [...COLUMNS];

    // Shift headers to Row 6 by inserting 5 blank rows at the top
    worksheet.spliceRows(1, 0, [], [], [], [], []);

    // Build the Report Header Block
    worksheet.getCell('A1').value = 'PLACEHUB – JOBS & APPLICATION REPORT';
    worksheet.mergeCells(1, 1, 1, COLUMNS.length);
    worksheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FF1E3A8A' } };
    worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.getCell('A2').value = 'College Name : Woxsen University';
    worksheet.mergeCells(2, 1, 2, COLUMNS.length);
    worksheet.getCell('A2').font = { bold: true };
    worksheet.getCell('A2').alignment = { horizontal: 'left', vertical: 'middle' };

    let filterText = 'Filters : All Jobs';
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
    worksheet.mergeCells(3, 1, 3, COLUMNS.length);
    worksheet.getCell('A3').alignment = { horizontal: 'left', vertical: 'middle' };

    // Format Generated On timestamp in IST
    const generatedOnStr = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    }).replace(/\b(am|pm)\b/g, match => match.toUpperCase()) + ' IST';
    worksheet.getCell('A4').value = `Generated On : ${safeExcelValue(generatedOnStr)}`;
    worksheet.mergeCells(4, 1, 4, COLUMNS.length);
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

    // Auto filter applied to the exact dimensions of the headers
    const firstDataRow = 7;
    const lastDataRow = firstDataRow + jobs.length - 1;

    if (jobs.length > 0) {
      worksheet.autoFilter = {
        from: { row: 6, column: 1 },
        to: { row: lastDataRow, column: COLUMNS.length }
      };
    } else {
      worksheet.autoFilter = {
        from: { row: 6, column: 1 },
        to: { row: 6, column: COLUMNS.length }
      };
    }

    // Add Rows
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      const jobIdStr = job._id.toString();
      const counts = countsMap[jobIdStr] || { applied: 0, inProgress: 0, selected: 0, rejected: 0 };

      const rowData = formatJobRow(job, counts, i);
      const row = worksheet.addRow(rowData);

      // Simple formatting for plain text wrapping and borders
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center',
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
    throw new AppError('Failed to generate Jobs Excel workbook', 500);
  }
};

module.exports = {
  generateJobExportWorkbook
};
