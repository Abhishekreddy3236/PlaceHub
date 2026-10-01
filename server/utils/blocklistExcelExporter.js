const ExcelJS = require('exceljs');
const AppError = require('./AppError');

const safeExcelValue = (value) => {
  if (value === null || value === undefined) return '';

  const strValue = String(value);
  if (/^[\s\uFEFF]*[=+\-@]/.test(strValue)) {
    return `'${strValue}`;
  }
  return strValue;
};

const COLUMN_DEFINITIONS = [
  { header: 'S.No', key: 'sno', width: 8 },
  { header: 'Admission ID', key: 'admissionId', width: 18 },
  { header: 'Email', key: 'email', width: 30 },
  { header: 'School', key: 'school', width: 20 },
  { header: 'Graduation Year', key: 'graduationYear', width: 15 },
  { header: 'Reason', key: 'reason', width: 20 },
  { header: 'Status', key: 'status', width: 15 }
];

const generateBlocklistExportWorkbook = async (blocklistRecords, filters = {}) => {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PlaceHub';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Candidate Blocklist', {
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

    worksheet.columns = COLUMN_DEFINITIONS;
    worksheet.spliceRows(1, 0, [], [], [], [], []);

    worksheet.getCell('A1').value = 'PLACEHUB – CANDIDATE BLOCKLIST';
    worksheet.mergeCells(1, 1, 1, COLUMN_DEFINITIONS.length);
    worksheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FF1E3A8A' } };
    worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.getCell('A2').value = 'College Name : Woxsen University';
    worksheet.mergeCells(2, 1, 2, COLUMN_DEFINITIONS.length);
    worksheet.getCell('A2').font = { bold: true };
    worksheet.getCell('A2').alignment = { horizontal: 'left', vertical: 'middle' };

    let filterText = 'Filters : All Candidates';
    const filterParts = [];
    if (filters.schools && filters.schools.length > 0) {
      filterParts.push(`School = ${filters.schools.join(', ')}`);
    }
    if (filters.graduationYears && filters.graduationYears.length > 0) {
      filterParts.push(`Graduation Year = ${filters.graduationYears.join(', ')}`);
    }
    if (filters.reasons && filters.reasons.length > 0) {
      filterParts.push(`Reason = ${filters.reasons.join(', ')}`);
    }
    if (filters.status) {
      filterParts.push(`Status = ${filters.status}`);
    }

    if (filterParts.length > 0) {
      filterText = `Filters : ${filterParts.join(' | ')}`;
    }

    worksheet.getCell('A3').value = safeExcelValue(filterText);
    worksheet.mergeCells(3, 1, 3, COLUMN_DEFINITIONS.length);
    worksheet.getCell('A3').alignment = { horizontal: 'left', vertical: 'middle' };

    const generatedOnStr = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    }).replace(/\b(am|pm)\b/g, match => match.toUpperCase()) + ' IST';

    worksheet.getCell('A4').value = `Generated On : ${safeExcelValue(generatedOnStr)}`;
    worksheet.mergeCells(4, 1, 4, COLUMN_DEFINITIONS.length);
    worksheet.getCell('A4').alignment = { horizontal: 'left', vertical: 'middle' };

    worksheet.getRow(1).height = 24;
    worksheet.getRow(2).height = 20;
    worksheet.getRow(3).height = 20;
    worksheet.getRow(4).height = 20;
    worksheet.getRow(5).height = 10;

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

    const firstDataRow = 7;
    const lastDataRow = firstDataRow + blocklistRecords.length - 1;

    if (blocklistRecords.length > 0) {
      worksheet.autoFilter = {
        from: { row: 6, column: 1 },
        to: { row: lastDataRow, column: COLUMN_DEFINITIONS.length }
      };
    } else {
      worksheet.autoFilter = {
        from: { row: 6, column: 1 },
        to: { row: 6, column: COLUMN_DEFINITIONS.length }
      };
    }

    for (let i = 0; i < blocklistRecords.length; i++) {
      const record = blocklistRecords[i];

      const rowData = {
        sno: i + 1,
        admissionId: safeExcelValue(record.admissionId || 'N/A'),
        email: safeExcelValue(record.email || 'N/A'),
        school: safeExcelValue(record.school || 'N/A'),
        graduationYear: record.graduationYear || 'N/A',
        reason: safeExcelValue(record.reason || 'None'),
        status: safeExcelValue(record.isBlocked ? 'Blocked' : 'Unblocked')
      };

      const row = worksheet.addRow(rowData);

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const isEmailColumn = colNumber === 3;
        cell.alignment = {
          vertical: 'middle',
          horizontal: isEmailColumn ? 'left' : 'center',
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

    worksheet.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
        if (rowNumber < 6) return;
        let columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = Math.max(10, Math.min(maxLength + 2, 50));
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;

  } catch (error) {
    throw new AppError('Failed to generate Candidate Blocklist Excel workbook', 500);
  }
};

module.exports = {
  generateBlocklistExportWorkbook
};
