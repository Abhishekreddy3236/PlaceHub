import { useState } from 'react';
import { HiX, HiOutlineLink } from 'react-icons/hi';
import api from '../services/api';

export default function ProfileReviewModal({
  user,
  onConfirm,
  onCancel,
  applying,
}) {
  const [previewLoading, setPreviewLoading] = useState(false);

  const handlePreviewResume = async () => {
    let newTab = null;
    try {
      newTab = window.open('', '_blank');
      setPreviewLoading(true);

      const res = await api.get('/users/me/resume');
      const url = res.data?.data?.resumeUrl;

      if (url && newTab) {
        newTab.location.href = url;
      } else if (newTab) {
        newTab.close();
      }
    } catch (err) {
      if (newTab) newTab.close();
    } finally {
      setPreviewLoading(false);
    }
  };

  const resumes = user?.resumes || [];
  const profileLinks = Array.isArray(user?.links)
    ? user?.links?.filter((link) => link?.url) || []
    : [];
  const links = profileLinks.length > 0
    ? profileLinks
    : [
      user?.linkedin ? { heading: 'LinkedIn', url: user?.linkedin } : null,
      user?.github ? { heading: 'GitHub', url: user?.github } : null,
      user?.portfolio ? { heading: 'Portfolio', url: user?.portfolio } : null,
    ].filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 sm:p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg max-h-[calc(100dvh-8rem)] sm:max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-5 sm:p-6 pb-4 shrink-0 border-b border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-slate-900">Review Your Profile</h2>
            <button onClick={onCancel} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-600 transition-colors">
              <HiX size={20} />
            </button>
          </div>
          <p className="text-sm text-slate-600">
            Please review your profile details before applying. This information will be shared with the recruiter.
          </p>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:grid sm:grid-cols-[140px_1fr] sm:gap-x-4 gap-y-1 text-sm">
            <span className="text-slate-500 text-xs sm:text-sm font-semibold sm:font-normal">Name</span>
            <span className="text-slate-900 font-medium text-left">{user?.name || '-'}</span>
          </div>
          <div className="flex flex-col sm:grid sm:grid-cols-[140px_1fr] sm:gap-x-4 gap-y-1 text-sm">
            <span className="text-slate-500 text-xs sm:text-sm font-semibold sm:font-normal">Email</span>
            <span className="text-slate-900 font-medium text-left break-all">{user?.email || '-'}</span>
          </div>
          <div className="flex flex-col sm:grid sm:grid-cols-[140px_1fr] sm:gap-x-4 gap-y-1 text-sm">
            <span className="text-slate-500 text-xs sm:text-sm font-semibold sm:font-normal">Age</span>
            <span className="text-slate-900 font-medium text-left">{user?.age || '-'}</span>
          </div>
          <div className="flex flex-col sm:grid sm:grid-cols-[140px_1fr] sm:gap-x-4 gap-y-1 text-sm">
            <span className="text-slate-500 text-xs sm:text-sm font-semibold sm:font-normal">Branch</span>
            <span className="text-slate-900 font-medium text-left">{user?.branch || '-'}</span>
          </div>
          <div className="flex flex-col sm:grid sm:grid-cols-[140px_1fr] sm:gap-x-4 gap-y-1 text-sm">
            <span className="text-slate-500 text-xs sm:text-sm font-semibold sm:font-normal">CGPA</span>
            <span className="text-slate-900 font-medium text-left">{user?.cgpa ?? '-'}</span>
          </div>
          <div className="flex flex-col sm:grid sm:grid-cols-[140px_1fr] sm:gap-x-4 gap-y-1 text-sm">
            <span className="text-slate-500 text-xs sm:text-sm font-semibold sm:font-normal">10th %</span>
            <span className="text-slate-900 font-medium text-left">{user?.tenthPercentage ?? '-'}</span>
          </div>
          <div className="flex flex-col sm:grid sm:grid-cols-[140px_1fr] sm:gap-x-4 gap-y-1 text-sm">
            <span className="text-slate-500 text-xs sm:text-sm font-semibold sm:font-normal">12th %</span>
            <span className="text-slate-900 font-medium text-left">{user?.twelfthPercentage ?? '-'}</span>
          </div>
          <div className="flex flex-col sm:grid sm:grid-cols-[140px_1fr] sm:gap-x-4 gap-y-1 text-sm">
            <span className="text-slate-500 text-xs sm:text-sm font-semibold sm:font-normal">Personal Email</span>
            <span className="text-slate-900 font-medium text-left break-all">{user?.personalEmail || '-'}</span>
          </div>
          <div className="flex flex-col sm:grid sm:grid-cols-[140px_1fr] sm:gap-x-4 gap-y-1 text-sm">
            <span className="text-slate-500 text-xs sm:text-sm font-semibold sm:font-normal">Mobile</span>
            <span className="text-slate-900 font-medium text-left">{user?.mobileNumber || '-'}</span>
          </div>
          <div className="flex flex-col sm:grid sm:grid-cols-[140px_1fr] sm:gap-x-4 gap-y-1 text-sm">
            <span className="text-slate-500 text-xs sm:text-sm font-semibold sm:font-normal">Gender</span>
            <span className="text-slate-900 font-medium text-left">{user?.gender || '-'}</span>
          </div>

          {user?.skills?.length > 0 && (
            <div className="pt-1">
              <span className="text-slate-500 text-xs sm:text-sm font-semibold sm:font-normal block mb-1.5 sm:mb-1">Skills</span>
              <div className="flex flex-wrap gap-1.5">
                {user?.skills?.map((s, i) => (
                  <span key={i} className="px-2.5 py-1 sm:px-2 sm:py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-xs font-medium hover:bg-slate-200 transition">{s}</span>
                ))}
              </div>
            </div>
          )}

          {links.length > 0 && (
            <div className="pt-2">
              <span className="text-slate-500 text-xs sm:text-sm font-semibold sm:font-normal block mb-2">Links</span>
              <div className="space-y-2.5 sm:space-y-2">
                {links.map((link) => (
                  <a key={link._id || link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between px-3.5 py-2.5 sm:px-3 sm:py-2 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors group cursor-pointer">
                    <div className="flex items-center gap-2">
                      <HiOutlineLink className="text-slate-400 text-sm group-hover:text-blue-500 transition-colors" />
                      <span className="text-sm text-slate-700 group-hover:text-blue-600 transition-colors">{link.heading}</span>
                    </div>
                    <span className="text-xs text-slate-400 truncate max-w-[200px] group-hover:text-blue-500 transition-colors">
                      {link.url}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {resumes.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-y-2 pt-4 border-t border-slate-100 mt-2">
              <span className="text-slate-500 text-xs sm:text-sm font-semibold sm:font-normal">Resume</span>
              <button
                type="button"
                className="text-blue-600 text-sm font-medium hover:underline disabled:opacity-50 text-left sm:text-right w-fit"
                onClick={handlePreviewResume}
                disabled={previewLoading}
              >
                {previewLoading ? 'Loading...' : 'Preview Resume'}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 shrink-0 bg-slate-50/50 rounded-b-2xl border-t border-slate-100">
          <div className="flex gap-2.5 sm:gap-3">
            <button onClick={onCancel} className="flex-1 px-4 sm:px-5 py-1.5 sm:py-2 text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition-all duration-200">
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={applying || !(resumes.length > 0)}
              className="flex-1 px-4 sm:px-5 py-1.5 sm:py-2 text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50"
            >
              Confirm & Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
