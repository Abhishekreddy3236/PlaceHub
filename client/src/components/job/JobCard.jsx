import { memo } from 'react';
import { Link } from 'react-router-dom';
import { HiOutlineLocationMarker, HiOutlineBriefcase, HiOutlineClock, HiOutlineOfficeBuilding } from 'react-icons/hi';

function JobCard({ job, isMissedOpportunity }) {
  const deadlineDate = job.applicationDeadline ? new Date(job.applicationDeadline) : job.deadline ? new Date(job.deadline) : null;
  const isExpired = deadlineDate ? deadlineDate < new Date() : false;
  const isNewJob = job.createdAt ? (Date.now() - new Date(job.createdAt).getTime()) < 24 * 60 * 60 * 1000 : false;

  return (
    <Link
      to={`/jobs/${job._id}`}
      className="card-hover block relative overflow-hidden p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-200 ease-out hover:-translate-y-[1px] bg-white/90 backdrop-blur-[2px]"
    >
      <div className="flex items-start justify-between gap-4 mt-1">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {job.logo ? (
            <img
              src={job.logo}
              alt={`${job.company} logo`}
              className="w-10 h-10 object-contain rounded-lg border border-slate-200 bg-white shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0">
              <HiOutlineOfficeBuilding className="text-slate-500 text-xl" />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-lg md:text-xl font-semibold text-slate-900 truncate">{job.title}</h3>
            <p className="text-blue-600 font-semibold hover:text-blue-700 transition mt-1">{job.company}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {isNewJob && (
            <span className="inline-block px-3 py-1 bg-blue-700 text-white rounded-full text-xs font-semibold uppercase tracking-wide">
              NEW
            </span>
          )}
          <span
            className={`shrink-0 px-2 py-1 rounded-full text-xs font-medium shadow-sm transition-colors ${isMissedOpportunity || isExpired ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-green-600 text-white hover:bg-green-700'
              }`}
          >
            {isMissedOpportunity
              ? 'Missed'
              : isExpired
                ? 'Closed'
                : 'Open'}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 mt-4 text-sm text-slate-500">
        <span className="flex items-center gap-1">
          <HiOutlineLocationMarker className="text-slate-500" />
          <span className="text-slate-600 font-medium">Location:</span>
          <span className="font-medium text-slate-900">{job.location}</span>
        </span>
        <span className="flex items-center gap-1">
          <HiOutlineBriefcase className="text-slate-500" />
          <span className="text-slate-600 font-medium">Type:</span>
          <span className="font-medium text-slate-900">{job.jobType}</span>
        </span>
        <span className="flex items-center gap-1">
          <HiOutlineClock className="text-slate-500" />
          <span className="text-slate-600 font-medium">Deadline:</span>
          <span className="font-medium text-slate-900">{deadlineDate ? deadlineDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase() : 'No deadline'}</span>
        </span>
      </div>

      {(job.eligibleSchools?.length > 0 || job.graduationYears?.length > 0) && (
        <div className="mt-3 text-sm text-slate-500 space-y-1">
          {job.eligibleSchools?.length > 0 && (
            <div>
              <span className="text-slate-600 font-medium">Eligible Branch:</span> <span className="font-medium text-slate-900">{job.eligibleSchools.join(', ')}</span>
            </div>
          )}
          {job.graduationYears?.length > 0 && (
            <div>
              <span className="text-slate-600 font-medium">Eligible Batch:</span> <span className="font-medium text-slate-900">{job.graduationYears.join(', ')}</span>
            </div>
          )}
        </div>
      )}

      {job.skills && job.skills.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {job.skills.slice(0, 4).map((skill, i) => (
            <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-xs font-medium">
              {skill}
            </span>
          ))}
          {job.skills.length > 4 && (
            <span className="px-2 py-1 text-slate-500 text-xs">+{job.skills.length - 4} more</span>
          )}
        </div>
      )}

      {job.matchScore !== undefined && (
        <div className="mt-3 text-xs text-green-600 font-medium">
          {job.matchScore} skill{job.matchScore !== 1 ? 's' : ''} matched
        </div>
      )}
    </Link>
  );
}

export default memo(JobCard);
