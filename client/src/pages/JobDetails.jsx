import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { applyToJob } from '../services/applicationService';
import { getJobDetailsContext } from '../services/jobService';
import { getApplicationReadiness, getProfile } from '../services/userService';
import { saveJob, unsaveJob } from '../services/savedJobService';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/ui/StatusBadge';
import ProfileReviewModal from '../components/ProfileReviewModal';
import RefreshButton from '../components/common/RefreshButton';
import JobAttachmentsList from '../components/job/JobAttachmentsList';
import toast from 'react-hot-toast';
import { showApiError } from '../services/api';
import { handleApiResponse } from '../utils/apiHandler';
import { JOB_ATTACHMENTS_KEY } from '../hooks/useJobAttachments';
import {
  APPLICATIONS_ROOT_KEY,
  DASHBOARD_QUERY_KEY,
  JOBS_ROOT_KEY,
  SAVED_JOBS_KEY,
} from '../services/queryClient';
import PageSkeleton from '../components/PageSkeleton';
import {
  HiOutlineLocationMarker,
  HiOutlineBriefcase,
  HiOutlineClock,
  HiOutlineBookmark,
  HiBookmark,
  HiOutlineOfficeBuilding,
  HiOutlineArrowRight,
  HiOutlineChevronRight,
  HiOutlineChevronDown,
} from 'react-icons/hi';

const PROFILE_FIELD_LABELS = {
  name: 'Full Name',
  age: 'Age',
  branch: 'Branch',
  cgpa: 'CGPA',
  tenthPercentage: '10th Percentage',
  twelfthPercentage: '12th Percentage',
  personalEmail: 'Personal Email',
  mobileNumber: 'Mobile Number',
  gender: 'Gender',
};

export default function JobDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [job, setJob] = useState(null);
  const [applied, setApplied] = useState(false);
  const [application, setApplication] = useState(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [missingProfileFields, setMissingProfileFields] = useState([]);
  const [profileData, setProfileData] = useState(null);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setJob(null);
      return;
    }

    fetchData();
  }, [id]);

  const fetchData = async () => {
    if (!id) {
      setLoading(false);
      setJob(null);
      return;
    }

    setLoading(true);
    try {
      queryClient.refetchQueries({ queryKey: [JOB_ATTACHMENTS_KEY, id], type: 'active' }).catch(() => { });
      const response = await getJobDetailsContext(id);
      const data = handleApiResponse(response) || {};
      setJob(data.job || null);

      const applicationContext = data.application;
      const applied =
        typeof applicationContext === 'boolean'
          ? applicationContext
          : Boolean(applicationContext?.applied);

      setApplied(applied);
      setApplication(
        typeof applicationContext === 'object' && applicationContext
          ? applicationContext.application || null
          : null
      );

      setSaved(Boolean(data.saved ?? data.savedJob));
    } catch (err) {
      showApiError(err, 'Failed to load job');
    } finally {
      setLoading(false);
    }
  };

  const updateJobCaches = (applicationData) => {
    const contextKey = ['jobs', id, 'context'];

    queryClient.setQueryData(contextKey, (current) => {
      const currentData = current?.data ?? current ?? {};

      return {
        ...currentData,
        job: currentData.job || job || null,
        application: {
          applied: true,
          application: applicationData || currentData.application?.application || null,
        },
        saved: currentData.saved ?? saved,
        savedJob: currentData.savedJob ?? saved,
      };
    });

    const jobsQueries = queryClient.getQueriesData({ queryKey: ['jobs'] });
    jobsQueries.forEach(([key, cached]) => {
      const currentData = cached?.data ?? cached;
      if (!currentData || !Array.isArray(currentData.items)) {
        return;
      }

      let updated = false;
      const nextItems = currentData.items.map((jobItem) => {
        if (!jobItem || jobItem._id !== id) {
          return jobItem;
        }

        updated = true;
        return {
          ...jobItem,
          applied: true,
          application: applicationData || jobItem.application || null,
        };
      });

      if (!updated) {
        return;
      }

      const nextData = {
        ...currentData,
        items: nextItems,
      };

      queryClient.setQueryData(key, cached?.data ? { ...cached, data: nextData } : nextData);
    });
  };

  const handleApplyClick = async () => {
    if (!id) {
      toast.error('Job not found');
      return;
    }

    setApplying(true);
    try {
      const [readinessRes, profileRes] = await Promise.all([
        getApplicationReadiness(),
        getProfile(),
      ]);

      const readiness = readinessRes.data?.data || {};
      const data = profileRes.data?.data;
      const resumes = data.resumes || [];

      if (!readiness.complete) {
        setMissingProfileFields(readiness.missingFields || []);
        return;
      }

      if (!resumes.length) {
        toast.error('Please upload a resume before applying');
        navigate('/profile');
        return;
      }
      setProfileData(data);
      setShowModal(true);
    } catch (err) {
      showApiError(err, 'Failed to check profile');
    } finally {
      setApplying(false);
    }
  };

  const handleConfirmApply = async () => {
    if (!id) {
      toast.error('Job not found');
      return;
    }

    setShowModal(false);
    setApplying(true);
    try {
      const response = await applyToJob(id);
      const data = handleApiResponse(response);
      setApplied(true);
      setApplication(data || null);
      updateJobCaches(data || null);
      queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: APPLICATIONS_ROOT_KEY });
      queryClient.invalidateQueries({ queryKey: JOBS_ROOT_KEY });
      toast.success('Applied successfully!');
    } catch (error) {
      const missingFields =
        error.response?.data?.missingFields ||
        error.response?.data?.data?.missingFields ||
        [];

      if (missingFields.length > 0) {
        setMissingProfileFields(missingFields);
        return;
      }

      showApiError(error, 'Failed to apply');
    } finally {
      setApplying(false);
    }
  };

  const toggleSave = async () => {
    try {
      if (saved) {
        await unsaveJob(id);
        setSaved(false);
        queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: SAVED_JOBS_KEY });
        queryClient.invalidateQueries({ queryKey: JOBS_ROOT_KEY });
        toast.success('Removed from saved');
      } else {
        await saveJob(id);
        setSaved(true);
        queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: SAVED_JOBS_KEY });
        queryClient.invalidateQueries({ queryKey: JOBS_ROOT_KEY });
        toast.success('Job saved!');
      }
    } catch (err) {
      showApiError(err, 'Action failed');
    }
  };

  if (loading) {
    return <PageSkeleton variant="list" count={4} />;
  }

  if (!job) {
    return <div className="text-center py-20 text-slate-500">Job not found</div>;
  }

  const deadlineDate = job.applicationDeadline ? new Date(job.applicationDeadline) : job.deadline ? new Date(job.deadline) : null;
  const isExpired = deadlineDate ? deadlineDate < new Date() : false;
  const isNewJob = job.createdAt ? (Date.now() - new Date(job.createdAt).getTime()) < 24 * 60 * 60 * 1000 : false;

  const formatIST = (dateString) => {
    if (!dateString) return 'N/A';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return 'N/A';
    const parts = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).formatToParts(d);
    const day = parts.find(p => p.type === 'day')?.value || '01';
    const month = parts.find(p => p.type === 'month')?.value || 'Jan';
    const year = parts.find(p => p.type === 'year')?.value || '2026';
    let hour = parts.find(p => p.type === 'hour')?.value || '12';
    if (hour.length === 1) hour = `0${hour}`;
    let minute = parts.find(p => p.type === 'minute')?.value || '00';
    if (minute.length === 1) minute = `0${minute}`;
    const period = (parts.find(p => p.type === 'dayPeriod')?.value || 'AM').toUpperCase();
    return `${day} ${month} ${year}, ${hour}:${minute} ${period}`;
  };

  const renderInlineTokens = (text, currentWordCount, maxWords, isExpanded, onTruncate, isInsideLink = false) => {
    if (!text) return { elements: [], wordCount: 0, isTruncated: false };
    
    const tokenRegex = /(\[.+?\]\(https?:\/\/[^\s)]+\)|\[.+?\]\(www\.[^\s)]+\)|\*\*\*.*?\*\*\*|\*\*.*?\*\*|\*.*?\*|https?:\/\/[^\s]+|www\.[^\s]+)/g;
    const parts = text.split(tokenRegex);

    const elements = [];
    let localWordCount = 0;
    let truncated = false;

    for (let i = 0; i < parts.length; i++) {
      let part = parts[i];
      if (!part) continue;

      let isToken = (i % 2 !== 0);

      if (!isToken) {
        // Plain text
        let wordsInPart = part.split(/\s+/).filter(Boolean);
        let displayString = part;

        if (!isExpanded && currentWordCount + localWordCount + wordsInPart.length > maxWords) {
          const remainingWords = Math.max(0, maxWords - (currentWordCount + localWordCount));
          if (remainingWords > 0) {
            const matches = [...part.matchAll(/\S+\s*/g)];
            displayString = matches.slice(0, remainingWords).map(m => m[0]).join('').trimEnd() + '...';
          } else {
            if ((currentWordCount + localWordCount) === maxWords && elements.length > 0) {
              elements.push(<span key={`ellipsis-${i}`}>...</span>);
            }
            truncated = true;
            break;
          }
          truncated = true;
        }

        localWordCount += wordsInPart.length;
        if (displayString) {
          elements.push(<span key={i}>{displayString}</span>);
        }
        if (truncated) break;
      } else {
        // Token
        let isLink = false, isBold = false, isItalic = false, isBoldItalic = false;
        let href = null, innerText = part;
        let isRawUrl = false;

        const mdLinkMatch = part.match(/^\[(.+?)\]\((.+?)\)$/);
        if (mdLinkMatch) {
          innerText = mdLinkMatch[1];
          href = mdLinkMatch[2];
          isLink = true;
        } else if (part.startsWith('***') && part.endsWith('***') && part.length >= 6) {
          innerText = part.slice(3, -3);
          isBoldItalic = true;
        } else if (part.startsWith('**') && part.endsWith('**') && part.length >= 4 && !part.startsWith('***')) {
          innerText = part.slice(2, -2);
          isBold = true;
        } else if (part.startsWith('*') && part.endsWith('*') && part.length >= 2 && !part.startsWith('**')) {
          innerText = part.slice(1, -1);
          isItalic = true;
        } else if (part.match(/^(https?:\/\/|www\.)/i)) {
          href = part;
          innerText = part;
          isLink = true;
          isRawUrl = true;
        }

        if (isLink && href) {
          let cleanHref = href.trim();
          try {
            cleanHref = decodeURIComponent(cleanHref);
          } catch (e) {}
          cleanHref = cleanHref.toLowerCase().trim();
          
          if (cleanHref.startsWith('www.')) {
            href = `https://${href.trim()}`;
          } else if (!cleanHref.startsWith('https://')) {
            href = '#';
          }
        }

        let innerResult;
        
        if (isRawUrl) {
          let wordsInPart = innerText.split(/\s+/).filter(Boolean);
          let displayString = innerText;
          let isPartTruncated = false;

          if (!isExpanded && currentWordCount + localWordCount + wordsInPart.length > maxWords) {
            const remainingWords = Math.max(0, maxWords - (currentWordCount + localWordCount));
            if (remainingWords > 0) {
              const matches = [...innerText.matchAll(/\S+\s*/g)];
              displayString = matches.slice(0, remainingWords).map(m => m[0]).join('').trimEnd() + '...';
            } else {
              isPartTruncated = true;
            }
          }
          
          if (!isPartTruncated) {
             innerResult = {
               elements: [displayString],
               wordCount: wordsInPart.length,
               isTruncated: false
             };
             if (displayString !== innerText) innerResult.isTruncated = true;
          } else {
             innerResult = { elements: [], wordCount: 0, isTruncated: true };
          }
        } else {
          // Recursive parsing for bold/italic/links
          innerResult = renderInlineTokens(
            innerText,
            currentWordCount + localWordCount,
            maxWords,
            isExpanded,
            null,
            isInsideLink || isLink
          );
        }

        localWordCount += innerResult.wordCount;
        
        if (innerResult.elements.length > 0) {
          let node;
          if (isLink) node = <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline hover:text-blue-700 break-words inline">{innerResult.elements}</a>;
          else if (isBoldItalic) node = <strong key={i} className={`font-bold ${isInsideLink ? '' : 'text-slate-900'}`}><em className="italic">{innerResult.elements}</em></strong>;
          else if (isBold) node = <strong key={i} className={`font-bold ${isInsideLink ? '' : 'text-slate-900'}`}>{innerResult.elements}</strong>;
          else if (isItalic) node = <em key={i} className="italic">{innerResult.elements}</em>;
          else node = <span key={i}>{innerResult.elements}</span>;
          
          elements.push(node);
        }

        if (innerResult.isTruncated || (!isExpanded && currentWordCount + localWordCount >= maxWords)) {
          if (innerResult.elements.length === 0 && (currentWordCount + localWordCount) === maxWords && elements.length > 0) {
            elements.push(<span key={`ellipsis-${i}`}>...</span>);
          }
          truncated = true;
          break;
        }
      }
    }

    if (truncated && onTruncate) onTruncate();
    return { elements, wordCount: localWordCount, isTruncated: truncated };
  };

  const renderRichText = (text, isExpanded) => {
    if (!text) return { elements: 'No description available.', isTruncated: false };
    
    const maxWords = 100;
    const totalWordCount = text.split(/\s+/).filter(Boolean).length;
    
    const lines = text.split('\n');
    const elements = [];
    let currentWordCount = 0;
    let isTruncated = false;
    let currentList = [];
    
    const flushList = () => {
      if (currentList.length > 0) {
        elements.push(
          <ul key={`ul-${elements.length}`} className="list-disc pl-5 mb-2 space-y-1">
            {currentList}
          </ul>
        );
        currentList = [];
      }
    };
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      const isBullet = line.startsWith('- ');
      
      if (!isBullet) flushList();
      
      let textToRender = isBullet ? line.substring(2) : line;
      
      const { elements: inlineElements, wordCount } = renderInlineTokens(
        textToRender, 
        currentWordCount, 
        maxWords, 
        isExpanded,
        () => { isTruncated = true; }
      );
      
      currentWordCount += wordCount;
      
      if (isBullet) {
        currentList.push(<li key={`li-${i}`}>{inlineElements.length > 0 ? inlineElements : '\u00A0'}</li>);
      } else {
        elements.push(<div key={`p-${i}`} className="min-h-[1.5em]">{inlineElements.length > 0 ? inlineElements : '\u00A0'}</div>);
      }
      
      if (!isExpanded && isTruncated) break;
    }
    
    flushList();

    return { elements, isTruncated: totalWordCount > maxWords };
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-6">
          <div className="flex items-start gap-3.5 sm:gap-4 flex-1 min-w-0">
            {job.logo ? (
              <img
                src={job.logo}
                alt={`${job.company} logo`}
                className="w-12 h-12 sm:w-14 sm:h-14 object-contain rounded-xl border border-slate-200 bg-white shrink-0"
              />
            ) : (
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0">
                <HiOutlineOfficeBuilding className="text-slate-500" size={24} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 tracking-tight leading-snug break-words">
                {job.title || job.position || 'No title'}
              </h1>
              <p className="text-base sm:text-lg text-blue-600 font-semibold mt-1 break-words">
                {job.company?.name || job.companyName || job.company || 'Unknown Company'}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {isNewJob && (
                  <span className="shrink-0 px-2.5 py-0.5 bg-blue-600 text-white rounded-full text-[10px] font-semibold uppercase tracking-wide">
                    NEW
                  </span>
                )}
                <span
                  className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium shadow-sm transition-colors ${isExpired ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                >
                  {isExpired ? 'Closed' : 'Open'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <RefreshButton onClick={fetchData} loading={loading} hideLabelOnMobile={true} />
            {user?.role === 'student' && (
              <button onClick={toggleSave} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors">
                {saved ? <HiBookmark size={24} className="text-blue-600" /> : <HiOutlineBookmark size={24} />}
              </button>
            )}
          </div>
        </div>

        {/* Meta info */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-6 text-sm">
          <span className="flex items-center gap-1.5">
            <HiOutlineLocationMarker size={18} className="text-slate-400" />
            <span className="text-slate-500 font-medium">Location:</span>
            <span className="font-medium text-slate-900">{job.location}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <HiOutlineBriefcase size={18} className="text-slate-400" />
            <span className="text-slate-500 font-medium">Type:</span>
            <span className="font-medium text-slate-900">{job.jobType}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <HiOutlineClock size={18} className="text-slate-400" />
            <span className="text-slate-500 font-medium">Deadline:</span>
            <span className="font-medium text-slate-900">{deadlineDate ? deadlineDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase() : 'No deadline'}</span>
          </span>
          {job.salary && (
            <span className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Salary:</span>
              <span className="font-medium text-slate-900">{job.salary}</span>
            </span>
          )}
          {job.createdAt && (
            <span className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Created:</span>
              <span className="font-medium text-slate-900">{formatIST(job.createdAt)}</span>
            </span>
          )}
          {job.updatedAt && (
            <span className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Updated:</span>
              <span className="font-medium text-slate-900">{formatIST(job.updatedAt)}</span>
            </span>
          )}
        </div>

        {(job.eligibleSchools?.length > 0 || job.graduationYears?.length > 0) && (
          <div className="mb-8 text-sm space-y-2">
            {job.eligibleSchools?.length > 0 && (
              <div>
                <span className="text-slate-500 font-medium">Eligible branches:</span> <span className="font-medium text-slate-900">{job.eligibleSchools.join(', ')}</span>
              </div>
            )}
            {job.graduationYears?.length > 0 && (
              <div>
                <span className="text-slate-500 font-medium">Eligible Batch:</span> <span className="font-medium text-slate-900">{job.graduationYears.join(', ')}</span>
              </div>
            )}
          </div>
        )}

        {/* Skills */}
        {job.skills?.length > 0 && (
          <div className="mb-8">
            <h3 className="text-base font-bold text-slate-800 mb-3 tracking-wide">Required Skills</h3>
            <div className="flex flex-wrap gap-2">
              {job.skills.map((skill, i) => (
                <span key={i} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-md text-sm border border-blue-200">{skill}</span>
              ))}
            </div>
          </div>
        )}

        <JobAttachmentsList jobId={job.id || job._id} />

        {/* Description */}
        <div className="mb-8 bg-slate-50/50 -mx-2 sm:-mx-4 px-4 sm:px-6 py-5 sm:py-6 rounded-2xl border border-slate-100">
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-4 tracking-tight">Job Description</h3>
          <div className="text-slate-800 font-medium text-sm sm:text-base leading-relaxed break-words whitespace-pre-wrap">
            {job && renderRichText(job.description, isDescriptionExpanded).elements}
          </div>
          {job && renderRichText(job.description, isDescriptionExpanded).isTruncated && (
            <button
              onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
              className="mt-3 text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors focus:outline-none"
            >
              {isDescriptionExpanded ? 'Read less' : 'Read more'}
            </button>
          )}
        </div>

        {/* Requirements */}
        {job.requirements?.length > 0 && (
          <div className="mb-8">
            <h3 className="text-base font-bold text-slate-800 mb-3 tracking-wide">Requirements</h3>
            <ul className="list-disc list-outside ml-5 space-y-2 text-sm sm:text-base text-slate-800 font-medium leading-relaxed break-words">
              {job.requirements.map((req, i) => (
                <li key={i} className="pl-1">{req}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Hiring Rounds */}
        {job.rounds?.length > 0 && (
          <div className="mb-8">
            <h3 className="text-base font-bold text-slate-800 mb-3 tracking-wide">Selection Process</h3>
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-center sm:items-center gap-3 w-full">
              {job.rounds.map((round, i) => {
                const isRejectedHere = application?.status === 'rejected' && round.order === (application?.rejectedAtRound || application?.currentRound);
                const isCompleted = application?.status === 'selected' || (round.order < application?.currentRound);
                const isCurrent = application?.status !== 'rejected' && application?.status !== 'selected' && round.order === application?.currentRound;

                return (
                  <div key={i} className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                    {i > 0 && (
                      <div className="flex sm:contents">
                        <HiOutlineChevronDown className="text-slate-400 w-4 h-4 sm:hidden" />
                        <HiOutlineChevronRight className="text-slate-400 w-4 h-4 hidden sm:block" />
                      </div>
                    )}
                    <div className={`px-4 py-2 sm:px-3.5 sm:py-1.5 rounded-full text-xs font-medium border transition-all duration-200 text-center w-full sm:w-auto ${!applied || !application
                      ? 'bg-slate-100 text-slate-600 border-transparent'
                      : isCompleted
                        ? 'bg-green-600 text-white border-transparent'
                        : isRejectedHere
                          ? 'bg-slate-700 text-white border-transparent shadow-sm'
                          : isCurrent
                            ? 'bg-blue-100 text-blue-700 border-blue-200'
                            : 'bg-slate-100 text-slate-600 border-transparent'
                      }`}>
                      <span>{round.order}. {round.name || round.title || round.roundName || 'Round'}</span>
                      {round.description && (
                        <span className="ml-1">— {round.description}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}



        {/* Apply / Status */}
        {user?.role === 'student' && (
          <div className="border-t border-slate-200 pt-6">
            {applied ? (
              <div className="flex flex-col items-start gap-2">
                <span className="text-sm font-bold text-slate-700">Status</span>
                {application?.status === 'rejected' ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-600 text-white">
                      Rejected
                    </span>
                    <span className="text-sm text-slate-600">
                      • {job.rounds?.find(r => r.order === (application.rejectedAtRound || application.currentRound))?.name || `Round ${application.rejectedAtRound || application.currentRound}`}{application?.rejectionInfo?.isAbsent === true ? ' - Absent' : ''}
                    </span>
                  </div>
                ) : (
                  <StatusBadge status={application?.status || 'in_progress'} currentRound={application?.currentRound} />
                )}
              </div>
            ) : isExpired ? (
              <p className="text-sm text-red-500 font-medium">This job posting has expired</p>
            ) : (
              <button
                onClick={handleApplyClick}
                disabled={applying}
                className="px-6 py-2.5 text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50"
              >
                {applying ? 'Applying...' : 'Apply Now'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Profile Review Modal */}
      {showModal && (
        <ProfileReviewModal
          user={profileData}
          onConfirm={handleConfirmApply}
          onCancel={() => setShowModal(false)}
          applying={applying}
        />
      )}

      {missingProfileFields.length > 0 && (
        <IncompleteProfileModal
          fields={missingProfileFields}
          onClose={() => setMissingProfileFields([])}
          onProfile={() => navigate('/profile')}
        />
      )}
    </div>
  );
}

function IncompleteProfileModal({ fields, onClose, onProfile }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Clean backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" onClick={onClose} />

      {/* Premium SaaS Dialog Box */}
      <div className="relative w-full max-w-[480px] bg-white border border-slate-200/90 rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.25)] ring-1 ring-slate-900/5 overflow-hidden text-left">
        {/* Header Section */}
        <div className="p-6 sm:p-7 pb-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
                Complete Your Profile
              </h2>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                Please complete the following required fields in your profile before applying for this position.
              </p>
            </div>
          </div>

          {/* Missing Fields Checklist Card */}
          <div className="mt-5 rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 block">
              Required Fields to Update ({fields.length})
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
              {fields.map((field) => (
                <div
                  key={field}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white border border-slate-200/80 shadow-2xs text-sm font-medium text-slate-800"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  <span className="truncate">{PROFILE_FIELD_LABELS[field] || field}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-lg shadow-2xs transition-all duration-150"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onProfile}
            className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs hover:shadow-sm transition-all duration-150 flex items-center gap-2"
          >
            <span>Go to Profile</span>
            <HiOutlineArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
