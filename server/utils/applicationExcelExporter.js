const ExcelJS = require('exceljs');

const safeExcelValue = (value) => {
  if (value === null || value === undefined) return '';
  const strValue = String(value);
  const trimmed = strValue.trim();
  if (trimmed.startsWith('=') || trimmed.startsWith('+') || trimmed.startsWith('-') || trimmed.startsWith('@')) {
    return `'${strValue}`;
  }
  return strValue;
};

const formatDateIST = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (!Number.isFinite(d.getTime())) return '';

  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const parts = formatter.formatToParts(d);
  let day, month, year, hour, minute, dayPeriod;
  for (const part of parts) {
    if (part.type === 'day') day = part.value;
    if (part.type === 'month') month = part.value;
    if (part.type === 'year') year = part.value;
    if (part.type === 'hour') hour = part.value;
    if (part.type === 'minute') minute = part.value;
    if (part.type === 'dayPeriod') dayPeriod = part.value.toUpperCase();
  }

  return `${day}-${month}-${year} ${hour}:${minute} ${dayPeriod}`;
};

const formatReadableStatus = (status) => {
  if (!status) return 'In Progress';
  const lower = status.toLowerCase();
  if (lower === 'selected') return 'Selected';
  if (lower === 'rejected') return 'Rejected';
  if (lower.startsWith('in progress - ')) return status;
  return 'In Progress';
};

const formatApplicationStatus = (status, stage, isAbsent) => {
  const formattedStatus = formatReadableStatus(status);
  const stageName = stage || 'Round 1';

  let result = formattedStatus.includes(stageName) 
    ? formattedStatus 
    : `${formattedStatus} - ${stageName}`;

  if (formattedStatus === 'Rejected' && isAbsent) {
    result += ' - Absent';
  }

  return result;
};

const setupApplicationExportStream = (res, filters = {}, options = {}) => {
  const exportOptions = {
    stream: res,
    useStyles: true,
    useSharedStrings: false
  };

  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter(exportOptions);
  const worksheet = workbook.addWorksheet('Applications', {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalDpi: 300,
      verticalDpi: 300,
      margins: {
        left: 0.25,
        right: 0.25,
        top: 0.5,
        bottom: 0.5,
        header: 0.2,
        footer: 0.2
      }
    },
    properties: {
      pageSetUpPr: {
        fitToPage: true
      }
    }
  });

  worksheet.printTitlesRow = '1:2';

  const activeCols = [
    { key: 'col1', width: 30 }, // A: Roll Number / Company Name
    { key: 'col2', width: 35 }, // B: Admission ID / Job Title
    { key: 'col3', width: 35 }, // C: Name / Application Status
    { key: 'col4', width: 50 }  // D: Email / Applied Date (or shifted optional columns)
  ];

  let applicationColCount = 3; // Company, Title, Status
  if (options.includeAppliedDate !== false) applicationColCount++;
  if (options.includeSalary) applicationColCount++;
  if (options.includeLocation) applicationColCount++;

  let studentColCount = 4;
  if (options.includePersonalEmail) studentColCount++;
  if (options.includeMobileNumber) studentColCount++;

  const reportColumnCount = Math.max(4, applicationColCount, studentColCount);

  if (reportColumnCount > 4) {
    activeCols.push({ key: 'col5', width: 45 }); // E
  }
  if (reportColumnCount > 5) {
    activeCols.push({ key: 'col6', width: 30 }); // F
  }

  worksheet.columns = activeCols;
  const applicationColumnCount = applicationColCount;
  const lastColChar = String.fromCharCode(64 + reportColumnCount);

  const row1 = worksheet.addRow(['PLACEHUB – STUDENT PLACEMENT HISTORY REPORT']);
  worksheet.mergeCells(`A1:${lastColChar}1`);
  row1.getCell(1).font = { size: 16, bold: true, color: { argb: 'FF1E3A8A' } };
  row1.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  row1.height = 24;
  row1.commit();

  const row2 = worksheet.addRow(['College Name : Woxsen University']);
  worksheet.mergeCells(`A2:${lastColChar}2`);
  row2.getCell(1).font = { bold: true };
  row2.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
  row2.height = 20;
  row2.commit();

  let filterText = 'Filters : All Students';
  const filterParts = [];
  if (Array.isArray(filters.schools) && filters.schools.length > 0) {
    filterParts.push(`School = ${filters.schools.join(', ')}`);
  }
  if (Array.isArray(filters.graduationYears) && filters.graduationYears.length > 0) {
    filterParts.push(`Graduation Year = ${filters.graduationYears.join(', ')}`);
  }
  if (filters.status) {
    let statusName = filters.status;
    if (statusName === 'in_progress') statusName = 'In Progress';
    if (statusName === 'selected') statusName = 'Selected';
    if (statusName === 'rejected') statusName = 'Rejected';
    
    let statusFilter = `Status = ${statusName}`;
    if (filters.isAbsentOnly && filters.status === 'rejected') {
      statusFilter += ' (Absent Only)';
    }
    filterParts.push(statusFilter);
  }
  
  if (filterParts.length > 0) {
    filterText = `Filters : ${filterParts.join(' | ')}`;
  }

  const row3 = worksheet.addRow([safeExcelValue(filterText)]);
  worksheet.mergeCells(`A3:${lastColChar}3`);
  row3.getCell(1).font = { bold: true };
  row3.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
  row3.height = 20;
  row3.commit();

  const row4 = worksheet.addRow([`Generated On : ${formatDateIST(new Date())}`]);
  worksheet.mergeCells(`A4:${lastColChar}4`);
  row4.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
  row4.height = 20;
  row4.commit();

  const row5 = worksheet.addRow([]);
  row5.height = 10;
  row5.commit();

  return { workbook, worksheet };
};

const writeStudentSectionHeader = (worksheet, student, sectionNumber, options = {}) => {
  const displaySectionNumber = sectionNumber || 1;
  const applicationColumnCount = worksheet.columns.length;
  const reportColumnCount = Math.max(4, applicationColumnCount);
  const lastColChar = String.fromCharCode(64 + reportColumnCount);

  // Student Heading
  const titleRow = worksheet.addRow([`${displaySectionNumber}. Student Details: ${safeExcelValue(student.name)}`]);
  worksheet.mergeCells(`A${titleRow.number}:${lastColChar}${titleRow.number}`);
  titleRow.getCell(1).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
  titleRow.getCell(1).border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
  titleRow.commit();

  let headerVals = ['Roll Number', 'Admission ID', 'Name', 'College Email'];
  let dataVals = [
    safeExcelValue(student.rollNumber),
    safeExcelValue(student.admissionId),
    safeExcelValue(student.name),
    safeExcelValue(student.email)
  ];

  if (options.includePersonalEmail) {
    headerVals.push('Personal Email');
    dataVals.push(safeExcelValue(student.personalEmail));
  }
  if (options.includeMobileNumber) {
    headerVals.push('Mobile Number');
    dataVals.push(safeExcelValue(student.mobileNumber));
  }

  const studentFieldsCount = headerVals.length;

  while (headerVals.length < reportColumnCount) {
    headerVals.push('');
    dataVals.push('');
  }

  // Student Details Headers
  const sHeaders = worksheet.addRow(headerVals);
  sHeaders.eachCell(c => {
    c.font = { bold: true };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
    c.alignment = { vertical: 'middle', horizontal: 'center' };
    c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
  });

  if (studentFieldsCount < reportColumnCount) {
    const lastFieldColLetter = String.fromCharCode(64 + studentFieldsCount);
    const reportLastColLetter = String.fromCharCode(64 + reportColumnCount);
    worksheet.mergeCells(`${lastFieldColLetter}${sHeaders.number}:${reportLastColLetter}${sHeaders.number}`);
  }
  sHeaders.commit();

  // Student Details Values
  const sData = worksheet.addRow(dataVals);
  sData.eachCell((c, colNumber) => {
    const isLeft = colNumber >= 3;
    c.alignment = { vertical: 'middle', horizontal: isLeft ? 'left' : 'center', wrapText: true };
    c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
  });

  if (studentFieldsCount < reportColumnCount) {
    const lastFieldColLetter = String.fromCharCode(64 + studentFieldsCount);
    const reportLastColLetter = String.fromCharCode(64 + reportColumnCount);
    worksheet.mergeCells(`${lastFieldColLetter}${sData.number}:${reportLastColLetter}${sData.number}`);
  }
  sData.commit();

  const gap1 = worksheet.addRow([]);
  gap1.height = 10;
  gap1.commit();

  // Application History Header
  const appHeadersData = ['Company Name', 'Job Title', 'Application Status'];
  if (options.includeAppliedDate !== false) appHeadersData.push('Applied Date (IST)');
  if (options.includeSalary) appHeadersData.push('Salary Package');
  if (options.includeLocation) appHeadersData.push('Job Location');

  const applicationFieldsCount = appHeadersData.length;

  while (appHeadersData.length < reportColumnCount) {
    appHeadersData.push('');
  }

  const appHeaders = worksheet.addRow(appHeadersData);
  appHeaders.eachCell(c => {
    c.font = { bold: true };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
    c.alignment = { vertical: 'middle', horizontal: 'center' };
    c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
  });

  if (applicationFieldsCount < reportColumnCount) {
    const lastFieldColLetter = String.fromCharCode(64 + applicationFieldsCount);
    const reportLastColLetter = String.fromCharCode(64 + reportColumnCount);
    worksheet.mergeCells(`${lastFieldColLetter}${appHeaders.number}:${reportLastColLetter}${appHeaders.number}`);
  }
  appHeaders.commit();
};

const writeApplicationHistoryRow = (worksheet, app, job, resolvedRoundName, options = {}) => {
  const companyName = safeExcelValue(job?.companyName || '');
  const jobTitle = safeExcelValue(job?.title || '');

  const statusStr = formatApplicationStatus(app.status, resolvedRoundName || `Round ${app.currentRound || 1}`, Boolean(app.rejectionInfo?.isAbsent));
  const dateStr = formatDateIST(app.createdAt);

  const rowData = [companyName, jobTitle, statusStr];
  if (options.includeAppliedDate !== false) rowData.push(dateStr);
  if (options.includeSalary) rowData.push(safeExcelValue(job?.salary));
  if (options.includeLocation) rowData.push(safeExcelValue(job?.location));

  const reportColumnCount = worksheet.columns.length;
  const applicationFieldsCount = rowData.length;

  while (rowData.length < reportColumnCount) {
    rowData.push('');
  }

  const row = worksheet.addRow(rowData);

  row.eachCell((c, colNumber) => {
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
  });

  if (applicationFieldsCount < reportColumnCount) {
    const lastFieldColLetter = String.fromCharCode(64 + applicationFieldsCount);
    const reportLastColLetter = String.fromCharCode(64 + reportColumnCount);
    worksheet.mergeCells(`${lastFieldColLetter}${row.number}:${reportLastColLetter}${row.number}`);
  }
  row.commit();
};

const writeStudentSectionFooter = (worksheet, totalCount) => {
  const row = worksheet.addRow([`Total Applications: ${totalCount}`]);
  const applicationColumnCount = worksheet.columns.length;
  const reportColumnCount = Math.max(4, applicationColumnCount);
  const lastColChar = String.fromCharCode(64 + reportColumnCount);
  
  worksheet.mergeCells(`A${row.number}:${lastColChar}${row.number}`);

  for (let i = 1; i <= reportColumnCount; i++) {
    const cell = row.getCell(i);
    cell.font = { bold: true, color: { argb: 'FF1E3A8A' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
    cell.alignment = { horizontal: 'right', vertical: 'middle' };
    cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
  }

  row.height = 22;
  row.commit();

  const gap = worksheet.addRow([]);
  gap.height = 20;
  gap.commit();
};

module.exports = {
  setupApplicationExportStream,
  writeStudentSectionHeader,
  writeApplicationHistoryRow,
  writeStudentSectionFooter
};
