const User = require('../models/User');
const Job = require('../models/Job');
const Company = require('../models/Company');
const Application = require('../models/Application');
const SavedJob = require('../models/SavedJob');
const Config = require('../models/Config');

const { createSlug, normalizeCompanyName } = require('../utils/company');

const bootstrapData = async () => {

  await Promise.all([
    User.updateMany(
      {
        $or: [
          { isActive: { $exists: false } },
          { isDeleted: { $exists: false } },
          { mustChangePassword: { $exists: false } },
        ],
      },
      {
        $set: {
          isActive: true,
          isDeleted: false,
          mustChangePassword: false,
        },
      }
    ),

    Job.updateMany(
      {
        $or: [
          { isActive: { $exists: false } },
          { isDeleted: { $exists: false } },
        ],
      },
      {
        $set: {
          isActive: true,
          isDeleted: false,
        },
      }
    ),

    Application.updateMany(
      {
        $or: [{ isDeleted: { $exists: false } }],
      },
      {
        $set: {
          isDeleted: false,
        },
      }
    ),

    SavedJob.updateMany(
      {
        $or: [{ isDeleted: { $exists: false } }],
      },
      {
        $set: {
          isDeleted: false,
        },
      }
    ),
  ]);

  //COMPANY MIGRATION

  const legacyJobs = await Job.find(
    {
      $or: [
        { companyId: { $exists: false } },
        { companyId: null },
      ],
      company: { $type: 'string', $ne: '' },
    },
    'company'
  )
    .setOptions({ withDeleted: true })
    .lean();

  const uniqueCompanyNames = [
    ...new Set(
      legacyJobs
        .map((job) => normalizeCompanyName(job.company))
        .filter(Boolean)
    ),
  ];

  const companies = await Company.find({}, '_id normalizedName')
    .setOptions({ withDeleted: true })
    .lean();

  const companyMap = new Map(
    companies.map((c) => [c.normalizedName, c._id])
  );

  for (const companyName of uniqueCompanyNames) {
    if (!companyMap.has(companyName)) {
      await Company.create({
        name: companyName,
        normalizedName: companyName,
        slug: createSlug(companyName),
      });
    }
  }

  const updatedCompanies = await Company.find({}, '_id normalizedName')
    .setOptions({ withDeleted: true })
    .lean();

  const updatedCompanyMap = new Map(
    updatedCompanies.map((c) => [c.normalizedName, c._id])
  );

  const jobsToUpdate = await Job.find(
    {
      $or: [
        { companyId: { $exists: false } },
        { companyId: null },
      ],
      company: { $type: 'string', $ne: '' },
    },
    '_id company'
  )
    .setOptions({ withDeleted: true })
    .lean();

  if (jobsToUpdate.length) {
    await Job.bulkWrite(
      jobsToUpdate
        .map((job) => ({
          updateOne: {
            filter: { _id: job._id },
            update: {
              $set: {
                companyId:
                  updatedCompanyMap.get(
                    normalizeCompanyName(job.company)
                  ) || null,
              },
            },
          },
        }))
        .filter((op) => op.updateOne.update.$set.companyId)
    );
  }

  const applicationsToUpdate = await Application.find(
    {
      $or: [
        { companyId: { $exists: false } },
        { companyId: null },
      ],
    },
    '_id jobId'
  )
    .setOptions({ withDeleted: true })
    .populate({
      path: 'jobId',
      select: 'companyId',
      options: { withDeleted: true },
    })
    .lean();

  if (applicationsToUpdate.length) {
    await Application.bulkWrite(
      applicationsToUpdate
        .map((application) => ({
          updateOne: {
            filter: { _id: application._id },
            update: {
              $set: {
                companyId:
                  application.jobId?.companyId || null,
              },
            },
          },
        }))
        .filter((op) => op.updateOne.update.$set.companyId)
    );
  }

  //CONFIG MIGRATION

  await Config.migrateAllowedDomainsIfNeeded();
  await Config.migrateRegistrationBooleansIfNeeded();
};

module.exports = bootstrapData;