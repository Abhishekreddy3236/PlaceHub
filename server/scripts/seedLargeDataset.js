require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Company = require('../models/Company');
const Job = require('../models/Job');
const Application = require('../models/Application');
// Conditionally require SavedJob if it exists (assuming it does based on exploration)
let SavedJob;
try {
  SavedJob = require('../models/SavedJob');
} catch (e) {
  SavedJob = null;
}
const bcrypt = require('bcrypt');
const { SCHOOLS, getAllowedYears } = require('../utils/constants');
const { GENDERS } = require('../utils/profileCompleteness');

const models = [User, Company, Job, Application];
if (SavedJob) models.push(SavedJob);
for (const model of models) {
  if (model && model.schema) {
    model.schema.add({ isSeedData: { type: Boolean, default: false } });
  }
}

const SEED_DOMAIN = 'seed.placehub.local';

// CLI Args
const isReset = process.argv.includes('--reset');
const seedArg = process.argv.find((arg) => arg.startsWith('--seed='));
const isDeterministic = !!seedArg;
let currentSeed = seedArg ? parseInt(seedArg.split('=')[1], 10) || 12345 : Date.now();

// LCG PRNG for deterministic randomness
function random() {
  currentSeed = (currentSeed * 9301 + 49297) % 233280;
  return currentSeed / 233280;
}

function getRandomInt(min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function getRandomItem(array) {
  return array[Math.floor(random() * array.length)];
}

function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function getRandomSubarray(array, size) {
  return shuffle(array).slice(0, size);
}

// Mock Data Generators
const FIRST_NAMES = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan', 'Shaurya', 'Atharv', 'Dhruv', 'Kabir', 'Saanvi', 'Aanya', 'Aadhya', 'Aaradhya', 'Ananya', 'Pari', 'Diya', 'Avni', 'Myra', 'Isha', 'Riya', 'Kriti', 'Neha', 'Sneha', 'Priya', 'Aditi', 'Rohan', 'Karan', 'Rahul', 'Vikram', 'Siddharth', 'Amit', 'Anil', 'Sunil', 'Raj', 'Ravi', 'Pooja', 'Anjali', 'Kavita', 'Geeta', 'Seema', 'Nisha', 'Meena', 'Renu', 'Sushma', 'Kiran'];
const LAST_NAMES = ['Sharma', 'Verma', 'Gupta', 'Malhotra', 'Singh', 'Patel', 'Kumar', 'Reddy', 'Rao', 'Das', 'Sen', 'Bose', 'Chowdhury', 'Mukherjee', 'Banerjee', 'Chatterjee', 'Nair', 'Menon', 'Pillai', 'Iyer', 'Jain', 'Shah', 'Mehta', 'Desai', 'Mishra', 'Pandey', 'Tiwari', 'Dubey', 'Yadav', 'Chauhan', 'Thakur', 'Rajput', 'Bhatia', 'Kaur', 'Khatri', 'Chawla', 'Ahuja', 'Kapoor', 'Mehra', 'Sethi'];
const COMPANY_WORDS_1 = ['Tech', 'Data', 'Cloud', 'AI', 'Global', 'Smart', 'NextGen', 'Future', 'Quantum', 'Cyber', 'Fin', 'Health', 'Eco', 'Bio', 'Neuro', 'Alpha', 'Omega', 'Prime', 'Apex', 'Zenith', 'Nova', 'Synergy', 'Nexus', 'Vertex', 'Stellar', 'Core', 'Vanguard', 'Pioneer', 'Horizon', 'Summit'];
const COMPANY_WORDS_2 = ['Solutions', 'Systems', 'Networks', 'Labs', 'Innovations', 'Technologies', 'Dynamics', 'Corp', 'Inc', 'LLC', 'Group', 'Partners', 'Consulting', 'Ventures', 'Holdings', 'Industries', 'Enterprises', 'Studios', 'Media', 'Soft', 'Analytics', 'Logic', 'Intelligence', 'Operations', 'Research', 'Logistics', 'Creative', 'Digital', 'Capital', 'Foundry'];
const DEPARTMENTS = ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance', 'Design', 'Product', 'Operations', 'IT', 'Support'];
const BRANCHES = ['Computer Science', 'Information Technology', 'Electronics', 'Electrical', 'Mechanical', 'Civil', 'Chemical', 'Aerospace', 'Biotechnology', 'Data Science'];
const SKILLS = ['JavaScript', 'Python', 'Java', 'C++', 'C#', 'Ruby', 'Go', 'Rust', 'Swift', 'Kotlin', 'React', 'Angular', 'Vue', 'Node.js', 'Express', 'Django', 'Flask', 'Spring Boot', 'SQL', 'MongoDB', 'PostgreSQL', 'MySQL', 'Redis', 'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP', 'Machine Learning', 'Deep Learning', 'Data Analysis', 'Data Engineering', 'DevOps', 'CI/CD', 'Git', 'Agile', 'Scrum', 'Leadership', 'Communication', 'Problem Solving'];
const SENIORITY = ['Junior', 'Mid-Level', 'Senior', 'Lead', 'Principal', 'Staff', 'Associate', 'Chief', 'Head of', 'Director of', 'VP of', 'Entry-Level'];
const ROLE = ['Software Engineer', 'Frontend Developer', 'Backend Developer', 'Full Stack Developer', 'Data Scientist', 'Machine Learning Engineer', 'DevOps Engineer', 'Cloud Architect', 'Product Manager', 'UX Designer', 'UI Designer', 'QA Engineer', 'System Administrator', 'Database Administrator', 'Security Analyst', 'Network Engineer', 'Mobile Developer', 'Business Analyst', 'Scrum Master', 'Technical Writer', 'Site Reliability Engineer', 'Platform Engineer', 'Data Analyst', 'Data Engineer', 'Security Engineer', 'Cloud Engineer'];
const TECH_STACK = ['(Java)', '(Python)', '(Node.js)', '(React)', '(Angular)', '(Go)', '(C++)', '(AWS)', '(Azure)', '(GCP)', '(Kubernetes)', '(MERN)', '(Django)', '(Ruby on Rails)', '(iOS)', '(Android)', '(Flutter)', '(React Native)', '(SQL)', '(NoSQL)'];
const DOMAIN = ['FinTech', 'HealthTech', 'EdTech', 'E-commerce', 'Cybersecurity', 'AI/ML', 'Blockchain', 'IoT', 'Enterprise', 'B2B', 'B2C', 'Gaming', 'Web3', 'Automotive'];
const CITIES = ['Mumbai', 'Delhi', 'Bengaluru', 'Hyderabad', 'Ahmedabad', 'Chennai', 'Kolkata', 'Surat', 'Pune', 'Jaipur', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Thane', 'Bhopal', 'Visakhapatnam', 'Pimpri-Chinchwad', 'Patna', 'Vadodara'];

function generateUniqueCompanies(count) {
  const companies = new Set();
  let attempts = 0;
  while (companies.size < count) {
    let name = `${getRandomItem(COMPANY_WORDS_1)} ${getRandomItem(COMPANY_WORDS_2)}`;
    if (random() > 0.5) name = `${getRandomItem(COMPANY_WORDS_1)} ${getRandomItem(COMPANY_WORDS_1)} ${getRandomItem(COMPANY_WORDS_2)}`;
    if (random() > 0.8) name = `${name} ${getRandomItem(['Global', 'International', 'India', 'Worldwide'])}`;
    companies.add(name);
    attempts++;
    if (attempts > 5000) throw new Error("Could not generate enough unique company names");
  }
  return Array.from(companies);
}

function generateUniqueJobTitles(count) {
  const titles = new Set();
  let attempts = 0;
  while (titles.size < count) {
    let title = '';
    if (random() > 0.3) title += getRandomItem(SENIORITY) + ' ';
    title += getRandomItem(ROLE);
    if (random() > 0.4) title += ` ${getRandomItem(TECH_STACK)}`;
    if (random() > 0.6) title += ` - ${getRandomItem(DOMAIN)}`;
    if (random() > 0.7) title += ` Team`;

    titles.add(title.trim());
    attempts++;
    if (attempts > 10000) throw new Error("Could not generate enough unique job titles");
  }
  return Array.from(titles);
}

function generateName() {
  return `${getRandomItem(FIRST_NAMES)} ${getRandomItem(LAST_NAMES)}`;
}

function createSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function hashPassword(plain) {
  return await bcrypt.hash(plain, 12);
}

const BATCH_SIZE = 2500;
async function batchInsert(Model, data, modelName) {
  let insertedCount = 0;
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const chunk = data.slice(i, i + BATCH_SIZE);
    try {
      const result = await Model.insertMany(chunk, { ordered: false });
      insertedCount += result.length;
    } catch (err) {
      if (err.code === 11000 && err.insertedDocs) {
        insertedCount += err.insertedDocs.length;

        // Report EXACTLY which unique index failed and how many dropped
        const failedCount = chunk.length - err.insertedDocs.length;
        console.error(`\n[!] Duplicate Key Error in ${modelName}`);
        console.error(`    - Failed Count: ${failedCount}`);
        console.error(`    - Failed Index: ${err.writeErrors[0]?.err?.index || 'unknown'}`);
        console.error(`    - Failing Key: ${JSON.stringify(err.writeErrors[0]?.err?.keyValue || {})}`);

        throw new Error(`Silent duplicates detected in ${modelName}. Aborting.`);
      } else {
        throw err;
      }
    }
    console.log(`--------------------------------------------------`);
    console.log(`${modelName}`);
    console.log(`--------------------------------------------------`);
    console.log(`Expected : ${data.length}`);
    console.log(`Inserted : ${insertedCount}`);
    console.log(`Missing  : ${data.length - insertedCount}\n`);
  }
}

async function deleteSeededData() {
  console.log(`\n--- Starting Reset Process ---`);

  const collections = [
    { name: 'Applications', model: Application },
    { name: 'Saved Jobs', model: SavedJob },
    { name: 'Jobs', model: Job },
    { name: 'Companies', model: Company },
    { name: 'Users', model: User }
  ];

  let hasError = false;

  let results = {};
  for (const { name, model } of collections) {
    if (!model) continue;
    try {
      const result = await model.deleteMany({ isSeedData: true });
      results[name] = result.deletedCount;
    } catch (err) {
      console.error(`[!] Failed to delete seeded ${name}: ${err.message}`);
      hasError = true;
    }
  }

  console.log(`Applications removed : ${results['Applications'] || 0}`);
  console.log(`SavedJobs removed : ${results['Saved Jobs'] || 0}`);
  console.log(`Jobs removed : ${results['Jobs'] || 0}`);
  console.log(`Companies removed : ${results['Companies'] || 0}`);
  console.log(`Users removed : ${results['Users'] || 0}`);

  console.log(`\nRemaining seeded documents:\n`);
  let validationFailed = false;
  let remains = {};
  for (const { name, model } of collections) {
    if (!model) continue;
    try {
      const remaining = await model.countDocuments({ isSeedData: true });
      remains[name] = remaining;
      if (remaining > 0) {
        validationFailed = true;
      }
    } catch (err) {
      console.error(`[!] Failed to count ${name}: ${err.message}`);
      validationFailed = true;
    }
  }

  console.log(`Applications : ${remains['Applications'] || 0}`);
  console.log(`SavedJobs : ${remains['Saved Jobs'] || 0}`);
  console.log(`Jobs : ${remains['Jobs'] || 0}`);
  console.log(`Companies : ${remains['Companies'] || 0}`);
  console.log(`Users : ${remains['Users'] || 0}\n`);

  if (hasError || validationFailed) {
    throw new Error(`Reset process encountered errors or left orphaned documents.`);
  }

  console.log(`--- Reset Complete ---\n`);
}

async function run() {
  const startTime = Date.now();

  try {
    await connectDB();
    console.log('Connected to MongoDB.');

    if (isReset) {
      await deleteSeededData();
      process.exit(0);
    }

    if (isDeterministic) {
      console.log(`\n[!] Running in DETERMINISTIC mode with seed: ${currentSeed}\n`);
    }

    console.log('\n--- Configuration Validation ---');
    const TARGET_ADMINS = 1;
    const TARGET_STAFF = 50;
    const TARGET_COMPANIES = 250;
    const TARGET_HRS = 350;
    const TARGET_JOBS = 350;
    const TARGET_STUDENTS = 1000;
    const TARGET_APPS = 33000;
    const TARGET_SAVED_JOBS = SavedJob ? 10000 : 0;

    const FIRST_HOT_JOB_COUNT = 15;
    const FIRST_HOT_JOB_APPS = 400;
    const SAME_COMPANY_HOT_JOB_COUNT = 5;
    const SAME_COMPANY_HOT_JOB_APPS = 400;

    const HOT_JOB_COUNT = FIRST_HOT_JOB_COUNT + SAME_COMPANY_HOT_JOB_COUNT;
    const HOT_JOB_APPLICATIONS = (FIRST_HOT_JOB_COUNT * FIRST_HOT_JOB_APPS) + (SAME_COMPANY_HOT_JOB_COUNT * SAME_COMPANY_HOT_JOB_APPS);
    const REMAINING_TARGET = TARGET_APPS - HOT_JOB_APPLICATIONS;
    const REMAINING_JOBS_COUNT = TARGET_JOBS - HOT_JOB_COUNT;
    const ACTIVE_STUDENTS = 950;

    if (TARGET_HRS !== TARGET_JOBS) throw new Error("TARGET_HRS must equal TARGET_JOBS");
    if (HOT_JOB_COUNT > TARGET_JOBS) throw new Error("HOT_JOB_COUNT cannot exceed TARGET_JOBS");
    if (REMAINING_TARGET < 0) throw new Error("remainingTarget cannot be negative");
    if (TARGET_APPS < HOT_JOB_APPLICATIONS) throw new Error("TARGET_APPS >= mandatory hot-job applications validation failed");
    if (REMAINING_TARGET > (ACTIVE_STUDENTS * REMAINING_JOBS_COUNT)) throw new Error("remainingTarget exceeds max possible student combinations for remaining jobs");

    // Pre-calculate hashes
    console.log('\n--- Generating Shared Password Hashes ---');
    const staffPasswordHash = await hashPassword('Staff@123');
    const hrPasswordHash = await hashPassword('Hr@12345');
    const studentPasswordHash = await hashPassword('Student@123');

    console.log('\n--- Checking for Existing Seed Data ---');
    const existingSeed = await User.findOne({ isSeedData: true }).select('_id');
    if (existingSeed) {
      throw new Error(`Existing seeded data detected. Please run with --reset first.`);
    }

    console.log('\n--- Starting Data Seeder ---');

    // ==========================================
    // 1. ADMIN USER
    // ==========================================
    let admin = await User.findOne({ role: 'admin', email: `seed.admin@${SEED_DOMAIN}` });
    if (!admin) {
      const pswd = await hashPassword('Admin@123');
      admin = await User.create({
        name: 'Seed Admin',
        email: `seed.admin@${SEED_DOMAIN}`,
        username: 'seed_admin',
        password: pswd,
        role: 'admin',
        isVerified: true,
        isSeedData: true
      });
      console.log('[+] Created Seed Admin User.');
    } else {
      console.log('[*] Seed Admin User already exists. Reusing.');
    }

    // ==========================================
    // 2. STAFF USERS (50)
    // ==========================================
    console.log('Generating Staff Users...');
    const staffDocs = [];
    const mixedStaffLogs = [];

    // Generate 20 unique valid mixed combinations
    const perms = ['none', 'read', 'write'];
    const mixedCombinations = [];
    for (let u of perms) {
      for (let j of perms) {
        for (let a of perms) {
          if (u === 'read' && j === 'read' && a === 'read') continue;
          if (u === 'write' && j === 'write' && a === 'write') continue;
          if (u === 'none' && j === 'none' && a === 'none') continue;
          mixedCombinations.push({ users: u, jobs: j, applications: a, settings: 'none' });
        }
      }
    }
    const selectedMixed = getRandomSubarray(mixedCombinations, 20);

    for (let i = 1; i <= 50; i++) {
      let permissions = {};
      let groupName = "";

      if (i <= 20) {
        permissions = { users: 'read', jobs: 'read', applications: 'read', settings: 'none' };
        groupName = "Read-Only";
      } else if (i <= 30) {
        permissions = { users: 'write', jobs: 'write', applications: 'write', settings: 'none' };
        groupName = "Full-Write";
      } else {
        permissions = selectedMixed[i - 31];
        groupName = "Mixed";
      }

      const email = `seed.staff${String(i).padStart(4, '0')}@${SEED_DOMAIN}`;

      if (groupName === "Mixed") {
        mixedStaffLogs.push({ email, permissions });
      }

      staffDocs.push({
        name: generateName(),
        email,
        username: `seed_staff_${i}`,
        password: staffPasswordHash,
        role: 'staff',
        permissions,
        isVerified: true,
        isSeedData: true
      });
    }
    await batchInsert(User, staffDocs, 'Staff Users');

    console.log('\n--- Staff Summary ---');
    console.log('Read-only staff: 20');
    console.log('Full-write staff: 10');
    console.log('Mixed-permission staff: 20\n');
    console.log('Mixed Staff Details:');
    mixedStaffLogs.forEach(log => {
      console.log(`- ${log.email} | Users: ${log.permissions.users}, Jobs: ${log.permissions.jobs}, Apps: ${log.permissions.applications}, Settings: none`);
    });
    console.log('----------------------\n');

    // ==========================================
    // 3. COMPANIES (300)
    // ==========================================
    console.log('Generating Companies...');
    const companyNames = generateUniqueCompanies(TARGET_COMPANIES);
    const companyDocs = companyNames.map((name) => ({
      _id: new mongoose.Types.ObjectId(),
      name,
      normalizedName: name.toLowerCase(),
      slug: createSlug(name),
      website: `https://${createSlug(name)}.com`,
      description: `Description for ${name}. Leading industry experts in ${getRandomItem(DEPARTMENTS)}.`,
      createdBy: admin._id,
      isActive: true,
      isSeedData: true
    }));
    await batchInsert(Company, companyDocs, 'Companies');

    // ==========================================
    // 4. HR USERS (400) & JOBS (400)
    // ==========================================
    console.log('Generating HR Users and Jobs...');
    const hrDocs = [];
    const jobDocs = [];
    const jobTitles = generateUniqueJobTitles(TARGET_JOBS);

    for (let i = 1; i <= TARGET_JOBS; i++) {
      // First batch of HRs get the companies 1-to-1.
      // Remaining HRs get a random existing company.
      const companyIndex = i <= TARGET_COMPANIES ? i - 1 : getRandomInt(0, TARGET_COMPANIES - 1);
      const company = companyDocs[companyIndex];

      const hrId = new mongoose.Types.ObjectId();
      const jobId = new mongoose.Types.ObjectId();
      hrDocs.push({
        _id: hrId,
        name: generateName(),
        email: `seed.hr${String(i).padStart(4, '0')}@${SEED_DOMAIN}`,
        username: `seed_hr_${i}`,
        password: hrPasswordHash,
        role: 'hr',
        companyId: company._id,
        jobId: jobId,
        isVerified: true,
        mustChangePassword: true,
        deliveryEmail: `seed.hr${String(i).padStart(4, '0')}@${SEED_DOMAIN}`,
        isSeedData: true
      });

      // Every HR gets exactly 1 Job. 400 HRs -> 400 Jobs.
      const title = jobTitles[i - 1];
      jobDocs.push({
        _id: jobId,
        title: title,
        normalizedTitle: title.toLowerCase(),
        company: company.name,
        companyId: company._id,
        description: `This is an amazing opportunity at ${company.name} for the role of ${title}.`,
        location: getRandomItem(CITIES),
        jobType: getRandomItem(['Full-time', 'Part-time', 'Internship', 'Contract']),
        salary: `${getRandomInt(5, 30)} LPA`,
        skills: getRandomSubarray(SKILLS, 5),
        deadline: new Date(Date.now() + getRandomInt(7, 60) * 24 * 60 * 60 * 1000), // 7 to 60 days in future
        postedBy: hrId,
        hrId: hrId,
        status: random() > 0.8 ? 'archived' : 'active', // Mix of active and closed (archived)
        isActive: true,
        eligibleSchools: getRandomSubarray(SCHOOLS, 4),
        graduationYears: [getRandomItem(getAllowedYears()), getRandomItem(getAllowedYears())],
        isSeedData: true
      });
    }

    await batchInsert(User, hrDocs, 'HR Users');
    await batchInsert(Job, jobDocs, 'Jobs');

    // ==========================================
    // 5. STUDENTS (2000)
    // ==========================================
    console.log('Generating Students...');
    const studentDocs = [];
    const allowedYears = getAllowedYears();

    // Distribution rule:
    // 40% -> B.Tech 2027
    // 60% -> Evenly distributed across ALL OTHER valid School + Year combinations
    const allCombinations = [];
    for (const school of SCHOOLS) {
      for (const year of allowedYears) {
        if (school === 'B. Tech' && year === 2027) continue; // Excluded from the "rest" bucket
        allCombinations.push({ school, year });
      }
    }

    const primaryCount = Math.floor(TARGET_STUDENTS * 0.4);
    for (let i = 1; i <= TARGET_STUDENTS; i++) {
      let assignedSchool = '';
      let assignedYear = 2026;

      if (i <= primaryCount) {
        assignedSchool = 'B. Tech';
        assignedYear = 2027;
      } else {
        const index = (i - (primaryCount + 1)) % allCombinations.length;
        assignedSchool = allCombinations[index].school;
        assignedYear = allCombinations[index].year;
      }

      studentDocs.push({
        _id: new mongoose.Types.ObjectId(),
        name: generateName(),
        email: `seed.student${String(i).padStart(4, '0')}@${SEED_DOMAIN}`,
        username: `seed_student_${i}`,
        password: studentPasswordHash,
        role: 'student',
        isVerified: true,
        school: assignedSchool,
        graduationYear: assignedYear,
        rollNumber: `ROLL${String(i).padStart(5, '0')}`,
        admissionId: `ADM${String(i).padStart(6, '0')}`,
        branch: getRandomItem(BRANCHES),
        cgpa: (random() * (10 - 5) + 5).toFixed(2), // 5.00 to 10.00
        tenthPercentage: getRandomInt(60, 100),
        twelfthPercentage: getRandomInt(60, 100),
        personalEmail: `personal.seed${i}@gmail.com`,
        mobileNumber: `9${String(getRandomInt(100000000, 999999999))}`, // 10 digit number
        gender: getRandomItem(GENDERS),
        skills: getRandomSubarray(SKILLS, getRandomInt(3, 8)),
        isSeedData: true
      });
    }
    await batchInsert(User, studentDocs, 'Students');

    // ==========================================
    // 6. APPLICATIONS (75000)
    // ==========================================
    console.log('Generating Applications...');
    const applicationDocs = [];
    const usedApplications = new Set();
    const appStatuses = ['in_progress', 'rejected', 'selected'];

    // Distribution mappings requested:
    // Pending 10% -> mapped to in_progress (10%)
    // In Progress 45% -> mapped to shortlisted (45%)
    // Rejected 25% + Withdrawn 5% -> mapped to rejected (30%)
    // Selected 15% -> mapped to selected (15%)
    // Utilizing all enum values: 'in_progress', 'shortlisted', 'rejected', 'selected'
    function getRandomStatus() {
      const r = random();
      if (r < 0.10) return 'in_progress';
      if (r < 0.55) return 'shortlisted';
      if (r < 0.85) return 'rejected';
      return 'selected';
    }

    // 1. Setup Active Students
    const numActiveStudents = ACTIVE_STUDENTS;

    // Extract primary placement batch (B.Tech 2027)
    const btech2027Students = studentDocs.filter(s => s.school === 'B. Tech' && s.graduationYear === 2027);
    const primaryBatchCount = Math.floor(numActiveStudents * 0.4);
    const primaryBatch = getRandomSubarray(btech2027Students, Math.min(primaryBatchCount, btech2027Students.length));

    // Extract remaining active students
    const remainingStudentsForSelection = studentDocs.filter(s => !primaryBatch.includes(s));
    const secondaryActiveBatch = getRandomSubarray(remainingStudentsForSelection, numActiveStudents - primaryBatch.length);

    const activeStudents = [...primaryBatch, ...secondaryActiveBatch];
    const studentApps = new Map();
    for (let s of activeStudents) {
      studentApps.set(s._id.toString(), new Set());
    }

    // 2. Setup Hot Jobs
    const first30HotJobs = jobDocs.slice(0, FIRST_HOT_JOB_COUNT);

    // 3. Setup Same Company Hot Jobs
    const companyGroups = {};
    for (let i = FIRST_HOT_JOB_COUNT; i < jobDocs.length; i++) {
      let job = jobDocs[i];
      if (!companyGroups[job.companyId]) companyGroups[job.companyId] = [];
      companyGroups[job.companyId].push(job);
    }
    let maxCompanyJobs = [];
    for (let key in companyGroups) {
      if (companyGroups[key].length > maxCompanyJobs.length) {
        maxCompanyJobs = companyGroups[key];
      }
    }
    let sameCompanyHotJobs = maxCompanyJobs.slice(0, SAME_COMPANY_HOT_JOB_COUNT);
    while (sameCompanyHotJobs.length < SAME_COMPANY_HOT_JOB_COUNT) {
      let extra = jobDocs.find(j => !first30HotJobs.includes(j) && !sameCompanyHotJobs.includes(j));
      sameCompanyHotJobs.push(extra);
    }

    const allHotJobs = [...first30HotJobs, ...sameCompanyHotJobs];

    // Assign unique students to FIRST HOT JOBS
    for (let job of first30HotJobs) {
      // Step 1: The primary batch students MUST ALWAYS apply
      for (let s of primaryBatch) {
        studentApps.get(s._id.toString()).add(job._id.toString());
      }

      // Step 2: Randomly select additional eligible active students from secondary batch
      let scoredSecondary = secondaryActiveBatch.map(s => ({
        student: s,
        score: studentApps.get(s._id.toString()).size + random() * 0.1
      }));
      scoredSecondary.sort((a, b) => a.score - b.score);

      let toPick = FIRST_HOT_JOB_APPS - primaryBatch.length;
      let picked = 0;
      if (toPick > 0) {
        for (let item of scoredSecondary) {
          let s = item.student;
          if (!studentApps.get(s._id.toString()).has(job._id.toString())) {
            studentApps.get(s._id.toString()).add(job._id.toString());
            picked++;
            if (picked === toPick) break;
          }
        }
      }
    }

    // Assign unique students to SAME COMPANY HOT JOBS
    for (let job of sameCompanyHotJobs) {
      // Prioritize ALL active students with fewer applications by sorting
      let scoredStudents = activeStudents.map(s => ({
        student: s,
        score: studentApps.get(s._id.toString()).size + random() * 0.1
      }));
      scoredStudents.sort((a, b) => a.score - b.score);

      let picked = 0;
      for (let item of scoredStudents) {
        let s = item.student;
        if (!studentApps.get(s._id.toString()).has(job._id.toString())) {
          studentApps.get(s._id.toString()).add(job._id.toString());
          picked++;
          if (picked === SAME_COMPANY_HOT_JOB_APPS) break;
        }
      }
    }

    // 4. Setup Remaining Jobs
    const remainingJobs = jobDocs.filter(j => !allHotJobs.includes(j));
    let weights = [];
    for (let i = 0; i < remainingJobs.length; i++) {
      weights.push(Math.pow(random(), 3));
    }
    let totalWeight = weights.reduce((a, b) => a + b, 0);
    let remainingTarget = REMAINING_TARGET;
    let jobAppCounts = weights.map(w => Math.floor((w / totalWeight) * remainingTarget));

    // Adjust rounding errors to hit exactly 35,000
    let currentSum = jobAppCounts.reduce((a, b) => a + b, 0);
    while (currentSum < remainingTarget) {
      let idx = getRandomInt(0, remainingJobs.length - 1);
      if (jobAppCounts[idx] < numActiveStudents) {
        jobAppCounts[idx]++;
        currentSum++;
      }
    }
    while (currentSum > remainingTarget) {
      let idx = getRandomInt(0, remainingJobs.length - 1);
      if (jobAppCounts[idx] > 1) {
        jobAppCounts[idx]--;
        currentSum--;
      }
    }

    // Assign remaining applications
    for (let i = 0; i < remainingJobs.length; i++) {
      let job = remainingJobs[i];
      let needed = jobAppCounts[i];

      if (needed <= 0) continue;

      let scoredStudents = activeStudents.map(s => ({
        student: s,
        score: studentApps.get(s._id.toString()).size + random() * 0.1
      }));
      scoredStudents.sort((a, b) => a.score - b.score);

      let picked = 0;
      for (let item of scoredStudents) {
        let s = item.student;
        if (!studentApps.get(s._id.toString()).has(job._id.toString())) {
          studentApps.get(s._id.toString()).add(job._id.toString());
          picked++;
          if (picked === needed) break;
        }
      }
    }

    // Convert Map back to Application documents
    for (let s of activeStudents) {
      let appliedJobIds = studentApps.get(s._id.toString());
      for (let jobId of appliedJobIds) {
        let job = jobDocs.find(j => j._id.toString() === jobId);
        applicationDocs.push({
          userId: s._id,
          student: s._id,
          jobId: job._id,
          companyId: job.companyId,
          profileSnapshot: {
            name: s.name,
            email: s.email,
            age: getRandomInt(20, 26),
            branch: s.branch,
            cgpa: s.cgpa,
            tenthPercentage: s.tenthPercentage,
            twelfthPercentage: s.twelfthPercentage,
            personalEmail: s.personalEmail,
            mobileNumber: s.mobileNumber,
            gender: s.gender,
            skills: s.skills,
            school: s.school,
            rollNumber: s.rollNumber,
            admissionId: s.admissionId,
            graduationYear: s.graduationYear
          },
          status: getRandomStatus(),
          currentRound: getRandomInt(1, 4),
          isSeedData: true
        });
      }
    }
    console.log("Application docs:", applicationDocs.length);

    // Pre-insertion Validation
    const generatedCount = applicationDocs.length;
    let duplicatePairs = 0;
    const pairSet = new Set();
    for (const app of applicationDocs) {
      const key = `${app.userId.toString()}_${app.jobId.toString()}`;
      if (pairSet.has(key)) {
        duplicatePairs++;
      }
      pairSet.add(key);
    }

    console.log(`\n--- Application Validation ---`);
    console.log(`Target applications: ${TARGET_APPS}`);
    console.log(`Generated applications: ${generatedCount}`);
    console.log(`Duplicate student-job pairs: ${duplicatePairs}`);

    if (generatedCount !== TARGET_APPS || duplicatePairs > 0) {
      throw new Error(`Application generation validation failed! Expected: ${TARGET_APPS}, Generated: ${generatedCount}, Duplicates: ${duplicatePairs}`);
    }

    await batchInsert(Application, applicationDocs, 'Applications');

    // Post-insertion Validation
    const dbAppCount = await Application.countDocuments({ isSeedData: true });
    console.log(`\n--- Post-Insertion Application Validation ---`);
    console.log(`Expected: ${TARGET_APPS}`);
    console.log(`Inserted: ${generatedCount}`);
    console.log(`Mongo Count: ${dbAppCount}`);

    if (dbAppCount !== TARGET_APPS) {
      throw new Error(`MongoDB application count mismatch! Expected: ${TARGET_APPS}, Actual: ${dbAppCount}`);
    }

    // ==========================================
    // 7. SAVED JOBS (20000)
    // ==========================================
    if (SavedJob) {
      console.log('Generating Saved Jobs...');
      const savedJobDocs = [];
      const usedSavedJobs = new Set();

      while (savedJobDocs.length < TARGET_SAVED_JOBS) {
        const student = studentDocs[getRandomInt(0, studentDocs.length - 1)];
        const job = jobDocs[getRandomInt(0, jobDocs.length - 1)];
        const compositeKey = `${student._id.toString()}_${job._id.toString()}`;

        if (!usedSavedJobs.has(compositeKey)) {
          usedSavedJobs.add(compositeKey);
          savedJobDocs.push({
            job: job._id,
            student: student._id,
            isSeedData: true
          });
        }
      }
      await batchInsert(SavedJob, savedJobDocs, 'Saved Jobs');
    }

    // Validation metrics
    const activeStudentCount = numActiveStudents;
    const zeroAppStudentCount = studentDocs.length - activeStudentCount;
    const minRemaining = Math.min(...jobAppCounts);
    const maxRemaining = Math.max(...jobAppCounts);
    const avgRemaining = (jobAppCounts.reduce((a, b) => a + b, 0) / jobAppCounts.length).toFixed(1);

    const studentAppSizes = Array.from(studentApps.values()).map(set => set.size);
    const minStudentApps = Math.min(...studentAppSizes);
    const maxStudentApps = Math.max(...studentAppSizes);
    const avgStudentApps = (studentAppSizes.reduce((a, b) => a + b, 0) / studentAppSizes.length).toFixed(1);

    // ==========================================
    // SUMMARY
    // ==========================================
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    // FETCH ALL COUNTS FIRST
    const actualAdminCount = await User.countDocuments({ role: 'admin', isSeedData: true });
    const actualStaffCount = await User.countDocuments({ role: 'staff', isSeedData: true });
    const actualHrCount = await User.countDocuments({ role: 'hr', isSeedData: true });
    const actualStudentCount = await User.countDocuments({ role: 'student', isSeedData: true });
    const actualCompanyCount = await Company.countDocuments({ isSeedData: true });
    const actualJobCount = await Job.countDocuments({ isSeedData: true });
    const actualAppCount = await Application.countDocuments({ isSeedData: true });
    const actualSavedJobCount = SavedJob ? await SavedJob.countDocuments({ isSeedData: true }) : 0;

    console.log('\n==========================================================');
    console.log('SUMMARY');
    console.log('==========================================================');

    const countCheck = (name, actual, expected) => {
      if (actual !== expected) {
        console.log(`\u274C ${name} inserted: ${actual} / ${expected}`);
        throw new Error(`${name} count mismatch. Expected ${expected}, found ${actual}`);
      }
      console.log(`\u2713 ${name} inserted: ${actual} / ${expected}`);
    };

    countCheck('Companies', actualCompanyCount, TARGET_COMPANIES);
    countCheck('HR', actualHrCount, TARGET_HRS);
    countCheck('Students', actualStudentCount, TARGET_STUDENTS);
    countCheck('Jobs', actualJobCount, TARGET_JOBS);
    countCheck('Applications', actualAppCount, TARGET_APPS);
    if (SavedJob) countCheck('Saved Jobs', actualSavedJobCount, TARGET_SAVED_JOBS);

    console.log(`\n\u2713 Total execution time: ${duration} seconds`);
    console.log('\n--- Validation Data ---');
    console.log(`Active students selected: ${activeStudentCount}`);
    console.log(`Students with zero applications: ${zeroAppStudentCount}`);
    console.log(`Applications per hot job: ${FIRST_HOT_JOB_APPS}`);
    console.log(`Applications per remaining job: Min ${minRemaining} | Avg ${avgRemaining} | Max ${maxRemaining}`);
    console.log(`Applications per active student: Min ${minStudentApps} | Avg ${avgStudentApps} | Max ${maxStudentApps}`);
    console.log('==========================================================\n');

    console.log('==========================================================');
    console.log('FINAL DATABASE VALIDATION');
    console.log('==========================================================\n');
    console.log('Collection        Expected    Actual    Status');
    console.log('------------------------------------------------');
    const tableRow = (name, expected, actual) => {
      const status = expected === actual ? 'PASS' : 'FAIL';
      console.log(`${name.padEnd(18)}${expected.toString().padEnd(12)}${actual.toString().padEnd(10)}${status}`);
      if (status === 'FAIL') throw new Error(`Final Database Validation failed for ${name}`);
    };

    tableRow('Admins', TARGET_ADMINS, actualAdminCount);
    tableRow('Staff', TARGET_STAFF, actualStaffCount);
    tableRow('HR', TARGET_HRS, actualHrCount);
    tableRow('Students', TARGET_STUDENTS, actualStudentCount);
    tableRow('Companies', TARGET_COMPANIES, actualCompanyCount);
    tableRow('Jobs', TARGET_JOBS, actualJobCount);
    tableRow('Applications', TARGET_APPS, actualAppCount);
    tableRow('SavedJobs', TARGET_SAVED_JOBS, actualSavedJobCount);

    console.log(`\n--- Post-Seed Relationship Validation ---`);

    const orphanHrs = await User.aggregate([{ $match: { role: 'hr', isSeedData: true } }, { $lookup: { from: 'jobs', localField: 'jobId', foreignField: '_id', as: 'job' } }, { $match: { job: { $size: 0 } } }, { $limit: 1 }]);
    if (orphanHrs.length > 0) throw new Error(`Orphan HR detected: HR ${orphanHrs[0]._id} has no matching Job`);
    console.log('HR -> Job ........ PASS');

    const orphanJobs = await Job.aggregate([{ $match: { isSeedData: true } }, { $lookup: { from: 'users', localField: 'hrId', foreignField: '_id', as: 'hr' } }, { $match: { hr: { $size: 0 } } }, { $limit: 1 }]);
    if (orphanJobs.length > 0) throw new Error(`Orphan Job detected: Job ${orphanJobs[0]._id} has no matching HR`);
    console.log('Job -> HR ........ PASS');

    const orphanJobCompanies = await Job.aggregate([{ $match: { isSeedData: true } }, { $lookup: { from: 'companies', localField: 'companyId', foreignField: '_id', as: 'company' } }, { $match: { company: { $size: 0 } } }, { $limit: 1 }]);
    if (orphanJobCompanies.length > 0) throw new Error(`Orphan Job detected: Job ${orphanJobCompanies[0]._id} has no matching Company`);
    console.log('Job -> Company ... PASS');

    const orphanAppUsers = await Application.aggregate([{ $match: { isSeedData: true } }, { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } }, { $match: { user: { $size: 0 } } }, { $limit: 1 }]);
    if (orphanAppUsers.length > 0) throw new Error(`Orphan Application detected: Application ${orphanAppUsers[0]._id} has no matching User`);
    console.log('Application -> User .... PASS');

    const orphanAppJobs = await Application.aggregate([{ $match: { isSeedData: true } }, { $lookup: { from: 'jobs', localField: 'jobId', foreignField: '_id', as: 'job' } }, { $match: { job: { $size: 0 } } }, { $limit: 1 }]);
    if (orphanAppJobs.length > 0) throw new Error(`Orphan Application detected: Application ${orphanAppJobs[0]._id} has no matching Job`);
    console.log('Application -> Job ..... PASS');

    if (SavedJob) {
      const orphanSavedJobStudents = await SavedJob.aggregate([{ $match: { isSeedData: true } }, { $lookup: { from: 'users', localField: 'student', foreignField: '_id', as: 'studentDoc' } }, { $match: { studentDoc: { $size: 0 } } }, { $limit: 1 }]);
      if (orphanSavedJobStudents.length > 0) throw new Error(`Orphan SavedJob detected: SavedJob ${orphanSavedJobStudents[0]._id} has no matching Student`);
      console.log('SavedJob -> Student .... PASS');

      const orphanSavedJobJobs = await SavedJob.aggregate([{ $match: { isSeedData: true } }, { $lookup: { from: 'jobs', localField: 'job', foreignField: '_id', as: 'jobDoc' } }, { $match: { jobDoc: { $size: 0 } } }, { $limit: 1 }]);
      if (orphanSavedJobJobs.length > 0) throw new Error(`Orphan SavedJob detected: SavedJob ${orphanSavedJobJobs[0]._id} has no matching Job`);
      console.log('SavedJob -> Job ........ PASS');
    }

    console.log(`\n--- Duplicate Summary ---`);
    const duplicateEmails = await User.aggregate([{ $match: { isSeedData: true } }, { $group: { _id: "$email", count: { $sum: 1 } } }, { $match: { count: { $gt: 1 } } }, { $limit: 1 }]);
    if (duplicateEmails.length > 0) throw new Error(`Duplicate email detected: ${duplicateEmails[0]._id}`);
    console.log('Duplicate Emails ............ 0');

    const duplicateUsernames = await User.aggregate([{ $match: { isSeedData: true } }, { $group: { _id: "$username", count: { $sum: 1 } } }, { $match: { count: { $gt: 1 } } }, { $limit: 1 }]);
    if (duplicateUsernames.length > 0) throw new Error(`Duplicate username detected: ${duplicateUsernames[0]._id}`);
    console.log('Duplicate Usernames ......... 0');

    const duplicateHrJobs = await User.aggregate([{ $match: { role: 'hr', isSeedData: true } }, { $group: { _id: "$jobId", count: { $sum: 1 } } }, { $match: { count: { $gt: 1 } } }, { $limit: 1 }]);
    if (duplicateHrJobs.length > 0) throw new Error(`Duplicate HR jobId detected: ${duplicateHrJobs[0]._id}`);
    console.log('Duplicate HR jobIds ......... 0');

    const duplicateJobHrs = await Job.aggregate([{ $match: { isSeedData: true } }, { $group: { _id: "$hrId", count: { $sum: 1 } } }, { $match: { count: { $gt: 1 } } }, { $limit: 1 }]);
    if (duplicateJobHrs.length > 0) throw new Error(`Duplicate Job hrId detected: ${duplicateJobHrs[0]._id}`);
    console.log('Duplicate Job hrIds ......... 0');

    console.log('\n[+] All Strict Post-Seed Validations Passed');
    console.log('==========================================================\n');

    mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error(`\n[!] Error during seeding: ${error.message}`);
    console.error(error.stack);
    mongoose.connection.close();
    process.exit(1);
  }
}

run();
