import { HiXMark, HiEnvelope, HiAcademicCap, HiCodeBracket, HiArrowTopRightOnSquare } from 'react-icons/hi2';
import downloadResume from '../../utils/downloadResume';
import { showApiError } from '../../services/api';

export default function ApplicantProfileModal({ isOpen, onClose, student }) {
  if (!isOpen || !student) return null;

  const rollPrefix = student.rollNumber ? `${String(student.rollNumber).trim().toUpperCase()}_` : '';
  const fallbackName = `${rollPrefix}${student.name ? student.name.toLowerCase().trim().replace(/\\s+/g, '_').replace(/[^a-z0-9_]/g, '') : 'student'}_resume.pdf`;
  const resumeFileName = student.resumeFileName || fallbackName;
  const profileLinks = Array.isArray(student.links) ? student.links.filter((link) => link?.url) : [];
  const links = profileLinks.length > 0
    ? profileLinks
    : [
      student.linkedin ? { heading: 'LinkedIn', url: student.linkedin } : null,
      student.github ? { heading: 'GitHub', url: student.github } : null,
      student.portfolio ? { heading: 'Portfolio', url: student.portfolio } : null,
    ].filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 rounded-t-2xl">
          <h3 className="text-lg font-semibold text-slate-900">Profile at time of application</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <HiXMark className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Identity */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 text-xl font-bold shrink-0">
              {student.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="min-w-0">
              <h4 className="text-slate-900 font-semibold text-lg truncate">{student.name}</h4>
              <p className="text-slate-500 text-sm flex items-center gap-1.5 truncate">
                <HiEnvelope className="w-3.5 h-3.5 shrink-0" />
                {student.email || student.personalEmail}
              </p>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3">
            {student.branch && (
              <InfoCard icon={<HiAcademicCap className="w-4 h-4 text-blue-600" />} label="Branch" value={student.branch} />
            )}
            {student.cgpa !== undefined && student.cgpa !== null && (
              <InfoCard icon={<span className="text-sm font-bold text-emerald-600">#</span>} label="CGPA" value={student.cgpa} />
            )}
            {student.tenthPercentage !== undefined && student.tenthPercentage !== null && (
              <InfoCard icon={<span className="text-sm font-bold text-blue-600">10</span>} label="10th %" value={student.tenthPercentage} />
            )}
            {student.twelfthPercentage !== undefined && student.twelfthPercentage !== null && (
              <InfoCard icon={<span className="text-sm font-bold text-teal-600">12</span>} label="12th %" value={student.twelfthPercentage} />
            )}
            {student.personalEmail && (
              <InfoCard icon={<HiEnvelope className="w-4 h-4 text-blue-600" />} label="Personal Email" value={student.personalEmail} />
            )}
            {student.mobileNumber && (
              <InfoCard icon={<span className="text-sm font-bold text-slate-600">M</span>} label="Mobile" value={student.mobileNumber} />
            )}
            {student.gender && (
              <InfoCard icon={<span className="text-sm font-bold text-blue-600">G</span>} label="Gender" value={student.gender} />
            )}
            {student.age && (
              <InfoCard icon={<span className="text-sm font-bold text-orange-600">@</span>} label="Age" value={student.age} />
            )}
            {student.rollNumber && (
              <InfoCard icon={<span className="text-sm font-bold text-slate-600">#</span>} label="Roll Number" value={student.rollNumber} />
            )}
            {student.admissionId && (
              <InfoCard icon={<span className="text-sm font-bold text-slate-600">ID</span>} label="Admission ID" value={student.admissionId} />
            )}
            {student.graduationYear && (
              <InfoCard icon={<span className="text-sm font-bold text-blue-600">Y</span>} label="Graduation Year" value={student.graduationYear} />
            )}
            {student.school && (
              <InfoCard icon={<span className="text-sm font-bold text-blue-600">P</span>} label="Program" value={student.school} />
            )}
          </div>

          {/* Skills */}
          {student.skills?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <HiCodeBracket className="w-3.5 h-3.5" />
                Skills
              </p>
              <div className="flex flex-wrap gap-1.5">
                {student.skills.map((skill, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-xs font-medium hover:bg-slate-200 transition"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Links */}
          {links.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Links</p>
              <div className="space-y-2">
                {links.map((link) => (
                  <a
                    key={link._id || link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-600 hover:text-slate-900 transition-all group"
                  >
                    <HiArrowTopRightOnSquare className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                    <span className="font-medium">{link.heading}</span>
                    <span className="text-slate-400 text-xs truncate ml-auto">{link.url}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Resume Frame/Button */}
          {student.resumeUrl && (
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Resume at time of application</p>
                <p className="text-sm text-slate-900 font-medium truncate mt-1">{resumeFileName}</p>
              </div>
              <div className="w-full h-96 border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                <iframe
                  src={student.resumeUrl}
                  className="w-full h-full border-0"
                  title={resumeFileName}
                >
                  <p className="text-sm text-slate-600 mb-2">Unable to display PDF inline.</p>
                </iframe>
              </div>
              <button
                type="button"
                onClick={() => downloadResume(student.resumeUrl, resumeFileName).catch((err) => showApiError(err, 'Download failed'))}
                className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-sm"
              >
                <HiArrowTopRightOnSquare className="w-4 h-4" />
                Download Resume
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon, label, value }) {
  return (
    <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
      <p className="text-xs text-slate-500 flex items-center gap-1.5 mb-0.5">
        {icon} {label}
      </p>
      <p className="text-slate-900 font-medium text-sm break-words">{value}</p>
    </div>
  );
}
