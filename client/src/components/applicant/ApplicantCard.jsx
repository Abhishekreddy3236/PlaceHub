import { formatDate } from '../../utils/dateFormatter';
import { memo } from 'react';
import { HiOutlineChevronRight } from 'react-icons/hi';
import { HiEye, HiDocumentText, HiArrowRight, HiXCircle } from 'react-icons/hi2';
import StatusBadge from '../ui/StatusBadge';
import downloadResume from '../../utils/downloadResume';
import { showApiError } from '../../services/api';
import api from '../../services/api';

function ApplicantCard({
  application,
  onAction,
  onViewProfile,
  canManageStatus = true,
  selectable = false,
  isSelected = false,
  onToggleSelect,
}) {
  const { job } = application;
  const student = application.profileSnapshot || application.student || {};
  const rounds = job?.rounds?.length > 0 ? job.rounds : application?.rounds || [];
  const currentRound = Number(application.currentRound) || 1;
  const status = application.status;
  const isAbsent = application.rejectionInfo?.isAbsent;
  const totalRounds = rounds.length || 1;

  const currentRoundInfo = rounds.find((r) => r.order === currentRound) || rounds[currentRound - 1];
  const currentRoundName = currentRoundInfo?.name || `Round ${currentRound}`;
  const formattedAppliedDate = formatDate(application?.createdAt);

  const handleViewResume = async (id) => {
    let newTab = null;
    try {
      newTab = window.open('', '_blank');
      const res = await api.get(`/applications/${id}/resume?mode=json`);
      const url = res.data?.data?.resumeUrl;

      if (!url || typeof url !== 'string') {
        if (newTab) newTab.close();
        alert('Resume not available');
        return;
      }

      if (newTab) {
        newTab.location.href = url;
      } else {
        // Fallback if popup blocked
        window.location.href = url;
      }
    } catch (err) {
      if (newTab) newTab.close();
      alert('Failed to load resume');
    }
  };

  const isFinal = status === 'selected' || status === 'Selected' || status === 'rejected' || status === 'Rejected';
  const canPromote = !isFinal;
  const canReject = !isFinal;

  return (
    <div
      className={`card-hover p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:-translate-y-[1px] transition-all duration-200 ease-out bg-white/90 backdrop-blur-[2px] ${isSelected ? 'border-blue-400 ring-2 ring-blue-100' : 'hover:border-blue-200'
        }`}
    >
      <div className="flex flex-col lg:flex-row items-start gap-5">
        {/* Left: candidate info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3 mb-3">
            {selectable && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleSelect?.(application._id)}
                className="mt-1.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
              />
            )}
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-sm shrink-0">
              {student?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="min-w-0">
              <h3 className="text-slate-900 font-semibold truncate">{student?.name || 'Unknown'}</h3>
              <p className="text-slate-700 text-sm truncate">Submitted Profile</p>
            </div>
          </div>

          {/* Job info */}
          <div className="mb-3 pl-[52px]">
            <p className="text-sm text-slate-600">
              <span className="text-blue-700 font-medium">{job?.title || 'Job Unavailable'}</span>
              {job?.company && <span className="text-slate-500"> at {job.company}</span>}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-1.5 text-sm mt-2">
              {student?.branch && <p className="truncate"><span className="text-slate-600 font-medium">Branch:</span> <span className="text-slate-900 font-medium">{student.branch}</span></p>}
              {student?.cgpa !== undefined && student?.cgpa !== null && <p><span className="text-slate-600 font-medium">CGPA:</span> <span className="text-slate-900 font-medium">{student.cgpa}</span></p>}
              {student?.tenthPercentage !== undefined && student?.tenthPercentage !== null && <p><span className="text-slate-600 font-medium">10th:</span> <span className="text-slate-900 font-medium">{student.tenthPercentage}%</span></p>}
              {student?.twelfthPercentage !== undefined && student?.twelfthPercentage !== null && <p><span className="text-slate-600 font-medium">12th:</span> <span className="text-slate-900 font-medium">{student.twelfthPercentage}%</span></p>}
              {student?.personalEmail && <p className="truncate"><span className="text-slate-600 font-medium">Email:</span> <span className="text-slate-900 font-medium">{student.personalEmail}</span></p>}
              {student?.mobileNumber && <p className="truncate"><span className="text-slate-600 font-medium">Mobile:</span> <span className="text-slate-900 font-medium">{student.mobileNumber}</span></p>}
              {student?.rollNumber && <p className="truncate"><span className="text-slate-600 font-medium">Roll:</span> <span className="text-slate-900 font-medium">{student.rollNumber}</span></p>}
              {student?.admissionId && <p className="truncate"><span className="text-slate-600 font-medium">Admission ID:</span> <span className="text-slate-900 font-medium">{student.admissionId}</span></p>}
              {student?.graduationYear && <p><span className="text-slate-600 font-medium">Grad:</span> <span className="text-slate-900 font-medium">{student.graduationYear}</span></p>}
              <p><span className="text-slate-600 font-medium">Applied:</span> <span className="text-slate-900 font-medium">{formattedAppliedDate}</span></p>
            </div>
          </div>

          {/* Round progress */}
          {rounds.length > 0 && (
            <div className="pl-[52px] mb-3">
              <div className="flex flex-wrap items-center gap-3">
                {rounds.map((round, i) => {
                  const roundOrder = round.order || i + 1;
                  const isRejectedHere = status === 'rejected' && roundOrder === (application.rejectedAtRound || currentRound);

                  return (
                    <div key={i} className="flex items-center gap-3">
                      {i > 0 && <HiOutlineChevronRight className="text-slate-400 w-4 h-4" />}
                      <div
                        title={round.name || round.title || round.roundName || 'Round'}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-all duration-200 ${status === 'selected' || roundOrder < currentRound
                          ? 'bg-green-600 text-white border-transparent'
                          : isRejectedHere
                            ? 'bg-slate-700 text-white border-transparent shadow-sm'
                            : roundOrder === currentRound
                              ? 'bg-blue-100 text-blue-700 border-blue-200'
                              : 'bg-slate-100 text-slate-500 border-transparent'
                          }`}
                      >
                        <span>{roundOrder}. {round.name || round.title || round.roundName || 'Round'}</span>
                        {round.description && !isRejectedHere && (
                          <span className="ml-1">— {round.description}</span>
                        )}
                        {isRejectedHere && (
                          <span className="ml-1 font-semibold">— Rejected{isAbsent === true ? ' - Absent' : ''}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Skills */}
          {student?.skills?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pl-[52px]">
              {student.skills.slice(0, 6).map((s, i) => (
                <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-xs font-medium hover:bg-slate-200 transition">
                  {s}
                </span>
              ))}
              {student.skills.length > 6 && (
                <span className="px-2 py-0.5 text-slate-500 text-xs">+{student.skills.length - 6} more</span>
              )}
            </div>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex flex-col items-end gap-3 shrink-0 lg:min-w-[220px]">
          <StatusBadge
            status={application.status}
            currentRound={currentRound}
            rounds={rounds}
            rejectedAtRound={application.rejectedAtRound}
            isAbsent={isAbsent}
          />

          {/* Action buttons row */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onViewProfile({
                ...(student || {}),
                resumeUrl: '',
                snapshotLabel: 'Profile at time of application',
              })}
              className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-1.5"
            >
              <HiEye className="w-3.5 h-3.5" />
              View Profile
            </button>
            <button
              type="button"
              onClick={() => handleViewResume(application._id)}
              className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-1.5"
              title="Resume at time of application"
            >
              <HiDocumentText className="w-3.5 h-3.5" />
              Resume
            </button>
          </div>

          {/* Round-based action buttons */}
          {canManageStatus && onAction && !isFinal && (
            <div className="flex items-center gap-1.5">
              {canPromote && (
                <button
                  onClick={() => onAction(application, 'promote')}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-all duration-200 shadow-sm hover:shadow flex items-center gap-1"
                >
                  <HiArrowRight className="w-3.5 h-3.5" />
                  {currentRound >= totalRounds ? 'Select' : 'Next Round'}
                </button>
              )}
              {canReject && (
                <button
                  onClick={() => onAction(application, 'reject')}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 border border-transparent rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1"
                >
                  <HiXCircle className="w-3.5 h-3.5" />
                  Reject
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(ApplicantCard);
