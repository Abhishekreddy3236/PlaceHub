import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  APPLICATIONS_ROOT_KEY,
  AUTH_QUERY_KEY,
  DASHBOARD_QUERY_KEY,
  PROFILE_QUERY_KEY,
  SAVED_JOBS_KEY,
} from '../services/queryClient';
import api, { showApiError } from '../services/api';
import toast from 'react-hot-toast';
import { HiOutlineDocumentText, HiOutlinePlus, HiOutlineTrash, HiOutlineUpload, HiOutlineUser, HiOutlineX, HiOutlineLogout } from 'react-icons/hi';
import { uploadResume } from '../services/userService';
import { handleApiResponse } from '../utils/apiHandler';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import LogoutConfirmModal from '../components/ui/LogoutConfirmModal';

const MAX_RESUME_SIZE_BYTES = 1024 * 1024;
const MAX_LINKS = 10;
const GENDER_OPTIONS = ['Male', 'Female', 'Other'];

const defaultForm = {
  name: '',
  age: '',
  branch: '',
  skills: [],
  cgpa: '',
  tenthPercentage: '',
  twelfthPercentage: '',
  personalEmail: '',
  mobileNumber: '',
  gender: '',
  school: '',
  rollNumber: '',
  admissionId: '',
  graduationYear: '',
  links: [],
};

const isValidHttpUrl = (value) => {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
};

const isFilled = (value) => String(value ?? '').trim() !== '';

const toNumber = (value) => Number(String(value).trim());

const validateProfileForm = (form) => {
  const nextErrors = {};

  if (!isFilled(form.name) || form.name.trim().length < 2) {
    nextErrors.name = 'Enter your full name';
  }

  const age = toNumber(form.age);
  if (!Number.isInteger(age) || age < 16 || age > 100) {
    nextErrors.age = 'Age must be between 16 and 100';
  }

  if (!isFilled(form.branch)) {
    nextErrors.branch = 'Branch is required';
  }

  const cgpa = toNumber(form.cgpa);
  if (!Number.isFinite(cgpa) || cgpa < 0 || cgpa > 10) {
    nextErrors.cgpa = 'CGPA must be between 0 and 10';
  }

  const tenthPercentage = toNumber(form.tenthPercentage);
  if (!Number.isFinite(tenthPercentage) || tenthPercentage < 0 || tenthPercentage > 100) {
    nextErrors.tenthPercentage = '10th percentage must be between 0 and 100';
  }

  const twelfthPercentage = toNumber(form.twelfthPercentage);
  if (!Number.isFinite(twelfthPercentage) || twelfthPercentage < 0 || twelfthPercentage > 100) {
    nextErrors.twelfthPercentage = '12th percentage must be between 0 and 100';
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(form.personalEmail).trim())) {
    nextErrors.personalEmail = 'Enter a valid personal email';
  }

  if (!/^[0-9]{10}$/.test(String(form.mobileNumber).trim())) {
    nextErrors.mobileNumber = 'Mobile number must be 10 digits';
  }

  if (!GENDER_OPTIONS.includes(form.gender)) {
    nextErrors.gender = 'Select a gender';
  }

  if (form.links.length > MAX_LINKS) {
    nextErrors.linksLimit = `You can add up to ${MAX_LINKS} links`;
  }

  const linkErrors = form.links.map((link) => {
    const rowErrors = {};
    if (!isFilled(link.heading)) {
      rowErrors.heading = 'Heading is required';
    }
    if (!isFilled(link.url) || !isValidHttpUrl(link.url)) {
      rowErrors.url = 'Enter a valid http or https URL';
    }
    return rowErrors;
  });

  if (linkErrors.some((row) => Object.keys(row).length > 0)) {
    nextErrors.links = linkErrors;
  }

  return nextErrors;
};

const hasValidationErrors = (errors) =>
  Object.entries(errors).some(([key, value]) => {
    if (key === 'links') {
      return Array.isArray(value) && value.some((row) => Object.keys(row).length > 0);
    }
    return Boolean(value);
  });

const normalizeLinks = (profile) => {
  const profileLinks = Array.isArray(profile.links) ? profile.links : [];

  if (profileLinks.length > 0) {
    return profileLinks.map((link) => ({
      _id: link._id,
      clientId: link._id,
      heading: link.heading || '',
      url: link.url || '',
    }));
  }

  return [
    profile.linkedin ? { heading: 'LinkedIn', url: profile.linkedin } : null,
    profile.github ? { heading: 'GitHub', url: profile.github } : null,
    profile.portfolio ? { heading: 'Portfolio', url: profile.portfolio } : null,
  ]
    .filter(Boolean)
    .map((link, index) => ({
      ...link,
      clientId: `legacy-${index}`,
    }));
};

const FieldError = ({ message }) =>
  message ? <p className="mt-1 text-xs text-red-600">{message}</p> : null;

const isRenderableResume = (resume) =>
  resume &&
  (!resume.status || resume.status === 'active') &&
  Number(resume.size || 0) > 0 &&
  Boolean(resume.resumeId);

export default function Profile() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(defaultForm);
  const [originalForm, setOriginalForm] = useState(null);
  const [originalLinks, setOriginalLinks] = useState([]);
  const [skillInput, setSkillInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [resumes, setResumes] = useState([]);
  const [previewResumeId, setPreviewResumeId] = useState('');
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [viewingResumeIds, setViewingResumeIds] = useState(new Set());
  const [downloadingResumeIds, setDownloadingResumeIds] = useState(new Set());

  const { logout, isLoggingOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const invalidateProfileMutationQueries = () => {
    queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: APPLICATIONS_ROOT_KEY });
    queryClient.invalidateQueries({ queryKey: SAVED_JOBS_KEY });
    queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
  };

  const setProfileForm = (nextForm) => {
    setForm(nextForm);
    setErrors(validateProfileForm(nextForm));
  };

  const applyProfileData = (data, { syncForm = true } = {}) => {
    if (!data) return null;

    const profileResumes = Array.isArray(data.resumes)
      ? data.resumes.filter(isRenderableResume)
      : [];
    const updatedProfile = { ...data, resumes: profileResumes };

    queryClient.setQueryData(PROFILE_QUERY_KEY, updatedProfile);
    queryClient.setQueryData(AUTH_QUERY_KEY, (prev) =>
      prev ? { ...prev, ...updatedProfile } : updatedProfile
    );
    setResumes(profileResumes);
    setPreviewResumeId((current) =>
      profileResumes.some((resume) => resume.resumeId === current)
        ? current
        : profileResumes[0]?.resumeId || ''
    );

    if (!syncForm) {
      return updatedProfile;
    }

    const links = normalizeLinks(updatedProfile);

    const nextForm = {
      ...defaultForm,
      name: updatedProfile.name || '',
      age: updatedProfile.age ?? '',
      branch: updatedProfile.branch || '',
      skills: updatedProfile.skills || [],
      cgpa: updatedProfile.cgpa ?? '',
      tenthPercentage: updatedProfile.tenthPercentage ?? '',
      twelfthPercentage: updatedProfile.twelfthPercentage ?? '',
      personalEmail: updatedProfile.personalEmail || '',
      mobileNumber: updatedProfile.mobileNumber || '',
      gender: updatedProfile.gender || '',
      school: updatedProfile.school || '',
      rollNumber: updatedProfile.rollNumber || '',
      admissionId: updatedProfile.admissionId || '',
      graduationYear: updatedProfile.graduationYear || '',
      links,
    };

    setOriginalLinks(links.filter((link) => link._id));
    setOriginalForm(structuredClone(nextForm));
    setProfileForm(nextForm);
    return updatedProfile;
  };

  const loadProfile = async () => {
    try {
      const response = await api.get('/users/profile');
      applyProfileData(handleApiResponse(response));
    } catch (err) {
      showApiError(err, 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleChange = (e) => {
    const nextForm = { ...form, [e.target.name]: e.target.value };
    setProfileForm(nextForm);
  };

  const addSkill = () => {
    const skill = skillInput.trim();
    if (skill && !form.skills.includes(skill)) {
      setProfileForm({ ...form, skills: [...form.skills, skill] });
      setSkillInput('');
    }
  };

  const removeSkill = (skill) => {
    setProfileForm({ ...form, skills: form.skills.filter((s) => s !== skill) });
  };

  const handleSkillKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSkill();
    }
  };

  const addLinkRow = () => {
    if (form.links.length >= MAX_LINKS) {
      toast.error(`You can add up to ${MAX_LINKS} links`);
      return;
    }

    setProfileForm({
      ...form,
      links: [
        ...form.links,
        {
          clientId: `new-${Date.now()}-${form.links.length}`,
          heading: '',
          url: '',
        },
      ],
    });
  };

  const updateLinkRow = (index, field, value) => {
    const links = form.links.map((link, currentIndex) =>
      currentIndex === index ? { ...link, [field]: value } : link
    );
    setProfileForm({ ...form, links });
  };

  const removeLinkRow = (index) => {
    const links = form.links.filter((_, currentIndex) => currentIndex !== index);
    setProfileForm({ ...form, links });
  };

  const syncProfileLinks = async () => {
    const originalById = new Map(originalLinks.map((link) => [link._id, link]));
    const currentIds = new Set(form.links.filter((link) => link._id).map((link) => link._id));
    const deletedIds = originalLinks
      .filter((link) => !currentIds.has(link._id))
      .map((link) => link._id);
    let latestLinks = null;
    const captureLinks = (response) => {
      const links = response?.data?.data?.links;
      if (Array.isArray(links)) {
        latestLinks = links;
      }
    };

    for (const linkId of deletedIds) {
      captureLinks(await api.delete(`/profile/link/${linkId}`));
    }

    for (const link of form.links) {
      const payload = {
        heading: link.heading.trim(),
        url: link.url.trim(),
      };

      if (!link._id) {
        captureLinks(await api.post('/profile/link', payload));
        continue;
      }

      const original = originalById.get(link._id);
      if (!original || original.heading !== payload.heading || original.url !== payload.url) {
        captureLinks(await api.put(`/profile/link/${link._id}`, payload));
      }
    }

    return latestLinks;
  };

  const getProfileFields = (f) => ({
    name: f.name,
    age: f.age,
    branch: f.branch,
    skills: f.skills,
    cgpa: f.cgpa,
    tenthPercentage: f.tenthPercentage,
    twelfthPercentage: f.twelfthPercentage,
    personalEmail: f.personalEmail,
    mobileNumber: f.mobileNumber,
    gender: f.gender,
  });

  const isProfileChanged = originalForm
    ? JSON.stringify(getProfileFields(form)) !== JSON.stringify(getProfileFields(originalForm))
    : false;

  const isLinksChanged = originalForm
    ? JSON.stringify(form.links) !== JSON.stringify(originalForm.links)
    : false;

  const hasChanges = isProfileChanged || isLinksChanged;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitted(true);

    const nextErrors = validateProfileForm(form);
    setErrors(nextErrors);

    if (hasValidationErrors(nextErrors)) {
      toast.error('Please fix the highlighted fields');
      return;
    }

    if (!hasChanges) {
      toast('No changes to save', { icon: 'ℹ️' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        age: toNumber(form.age),
        branch: form.branch.trim(),
        skills: form.skills,
        cgpa: toNumber(form.cgpa),
        tenthPercentage: toNumber(form.tenthPercentage),
        twelfthPercentage: toNumber(form.twelfthPercentage),
        personalEmail: form.personalEmail.trim().toLowerCase(),
        mobileNumber: form.mobileNumber.trim(),
        gender: form.gender,
      };

      const response = await api.put('/users/profile', payload);
      let updatedProfile = handleApiResponse(response);

      if (isLinksChanged) {
        const updatedLinks = await syncProfileLinks();
        if (Array.isArray(updatedLinks)) {
          updatedProfile = { ...updatedProfile, links: updatedLinks };
        }
      }

      applyProfileData(updatedProfile);
      invalidateProfileMutationQueries();
      toast.success('Profile updated!');
    } catch (error) {
      showApiError(error, 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleResumeUpload = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;

    const allowedTypes = ['application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return toast.error('Only PDF files are allowed');
    }
    if (file.size > MAX_RESUME_SIZE_BYTES) {
      return toast.error('File size must be 1MB or less');
    }

    setUploading(true);
    try {
      const response = await uploadResume(file);

      applyProfileData(handleApiResponse(response), { syncForm: false });
      invalidateProfileMutationQueries();
      toast.success('Resume uploaded!');
    } catch (error) {
      showApiError(error, 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleResumeReplace = async (resumeId, file, input) => {
    if (!file) return;

    if (file.type !== 'application/pdf') {
      input.value = '';
      return toast.error('Only PDF files are allowed');
    }

    if (file.size > MAX_RESUME_SIZE_BYTES) {
      input.value = '';
      return toast.error('File size must be 1MB or less');
    }

    setUploading(true);
    try {
      const response = await uploadResume(file);
      applyProfileData(handleApiResponse(response), { syncForm: false });
      invalidateProfileMutationQueries();
      toast.success('Resume replaced successfully!');
    } catch (error) {
      showApiError(error, 'Failed to replace resume');
    } finally {
      setUploading(false);
      input.value = '';
    }
  };

  const handleRemoveResume = async (resumeId) => {
    if (!window.confirm('Delete this resume from your profile? Existing applications will keep their submitted resume copies.')) return;

    try {
      await api.delete(`/resumes/${resumeId}`);
      await loadProfile();
      invalidateProfileMutationQueries();
      toast.success('Resume deleted successfully!');
    } catch (error) {
      showApiError(error, 'Failed to delete resume');
    }
  };

  const openResume = async (resume, download = false) => {
    if (!isRenderableResume(resume)) {
      toast.error('Resume not available');
      return;
    }

    const resumeId = resume.resumeId;
    if (download) {
      if (downloadingResumeIds.has(resumeId)) return;
      setDownloadingResumeIds(prev => new Set(prev).add(resumeId));
    } else {
      if (viewingResumeIds.has(resumeId)) return;
      setViewingResumeIds(prev => new Set(prev).add(resumeId));
    }

    try {
      const endpoint = download ? `/resumes/${resume.resumeId}?download=true` : `/resumes/${resume.resumeId}`;
      const res = await api.get(endpoint);
      const url = res.data?.data?.resumeUrl || res.data?.resumeUrl;

      if (url) {
        if (download) {
          const fetchRes = await fetch(url, { method: 'GET', credentials: 'omit' });
          if (!fetchRes.ok) {
            throw new Error('Download failed');
          }
          const blob = await fetchRes.blob();
          if (!blob || blob.size === 0) {
            throw new Error('Empty file received');
          }

          const objectUrl = URL.createObjectURL(blob);
          try {
            const anchor = document.createElement('a');
            anchor.href = objectUrl;
            anchor.download = resume.originalName || 'resume.pdf';
            anchor.style.display = 'none';
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
          } finally {
            setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
          }
        } else {
          const newTab = window.open('', '_blank');
          if (newTab) {
            newTab.location.href = url;
          } else {
            // Fallback if popup blocked
            window.location.href = url;
          }
        }
      }
    } catch (err) {
      toast.error('Failed to load resume');
    } finally {
      if (download) {
        setDownloadingResumeIds(prev => {
          const next = new Set(prev);
          next.delete(resumeId);
          return next;
        });
      } else {
        setViewingResumeIds(prev => {
          const next = new Set(prev);
          next.delete(resumeId);
          return next;
        });
      }
    }
  };



  const visibleResumes = resumes.filter(isRenderableResume);
  const previewResume =
    visibleResumes.find((resume) => resume.resumeId === previewResumeId) || visibleResumes[0];

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-start gap-3 mb-8">
        <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
          <HiOutlineUser className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-900 tracking-tight">Your Profile</h1>
          <p className="text-sm text-slate-600 mt-0.5">Manage your personal information and resume.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="font-bold text-slate-900 mb-4">Basic Information</h2>
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1.5">Full Name</label>
                <input type="text" name="name" value={form.name} onChange={handleChange} required className="w-full input text-sm" />
                <FieldError message={submitted ? errors.name : null} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1.5">Age</label>
                <input type="number" name="age" value={form.age} onChange={handleChange} required min="16" max="100" className="w-full input text-sm" />
                <FieldError message={submitted || form.age ? errors.age : null} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1.5">Gender</label>
                <select name="gender" value={form.gender} onChange={handleChange} required className="w-full input text-sm">
                  <option value="">Select gender</option>
                  {GENDER_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <FieldError message={submitted ? errors.gender : null} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1.5">School</label>
                <input type="text" value={form.school || 'Not Selected'} disabled className="w-full input text-sm bg-slate-50 cursor-not-allowed text-slate-600 font-semibold" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1.5">Roll Number</label>
                <input type="text" value={form.rollNumber || 'Not Available'} disabled className="w-full input text-sm bg-slate-50 cursor-not-allowed text-slate-600 font-semibold" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1.5">Branch</label>
                <input type="text" name="branch" value={form.branch} onChange={handleChange} required placeholder="e.g., Computer Science" className="w-full input text-sm" />
                <FieldError message={submitted ? errors.branch : null} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1.5">Admission ID</label>
                <input type="text" value={form.admissionId || 'Not Available'} disabled className="w-full input text-sm bg-slate-50 cursor-not-allowed text-slate-600 font-semibold" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1.5">CGPA (Out of 10)</label>
                <input type="number" name="cgpa" value={form.cgpa} onChange={handleChange} required step="0.01" min="0" max="10" className="w-full input text-sm" />
                <FieldError message={submitted || form.cgpa ? errors.cgpa : null} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1.5">10th %</label>
                <input type="number" name="tenthPercentage" value={form.tenthPercentage} onChange={handleChange} required step="0.01" min="0" max="100" className="w-full input text-sm" />
                <FieldError message={submitted || form.tenthPercentage ? errors.tenthPercentage : null} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1.5">12th %</label>
                <input type="number" name="twelfthPercentage" value={form.twelfthPercentage} onChange={handleChange} required step="0.01" min="0" max="100" className="w-full input text-sm" />
                <FieldError message={submitted || form.twelfthPercentage ? errors.twelfthPercentage : null} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1.5">Personal Email</label>
                <input type="email" name="personalEmail" value={form.personalEmail} onChange={handleChange} required className="w-full input text-sm" />
                <FieldError message={submitted || form.personalEmail ? errors.personalEmail : null} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1.5">Mobile Number</label>
                <input type="tel" name="mobileNumber" value={form.mobileNumber} onChange={handleChange} required inputMode="numeric" maxLength="10" className="w-full input text-sm" />
                <FieldError message={submitted || form.mobileNumber ? errors.mobileNumber : null} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1.5">Graduation Year</label>
                <input type="text" value={form.graduationYear || 'Not Available'} disabled className="w-full input text-sm bg-slate-50 cursor-not-allowed text-slate-600 font-semibold" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="font-bold text-slate-900 mb-4">Skills</h2>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={handleSkillKeyDown}
                placeholder="Type a skill and press Enter"
                className="flex-1 min-w-0 input text-sm"
              />
              <button type="button" onClick={addSkill} className="shrink-0 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm font-medium border border-slate-200 transition-colors">
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {form.skills.map((skill, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium border border-blue-200">
                  {skill}
                  <button type="button" onClick={() => removeSkill(skill)} className="hover:text-red-600" aria-label={`Remove ${skill}`}>
                    <HiOutlineX size={14} />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="font-bold text-slate-900">Links</h2>
              <button
                type="button"
                onClick={addLinkRow}
                disabled={form.links.length >= MAX_LINKS}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <HiOutlinePlus size={16} />
                Add Link
              </button>
            </div>
            <FieldError message={errors.linksLimit} />
            <div className="space-y-3">
              {form.links.map((link, index) => {
                const rowErrors = errors.links?.[index] || {};
                return (
                  <div key={link._id || link.clientId || index} className="grid sm:grid-cols-[1fr_1.4fr_auto] gap-3 items-start border border-slate-200 rounded-xl p-3 bg-slate-50">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Heading</label>
                      <input
                        type="text"
                        value={link.heading}
                        onChange={(e) => updateLinkRow(index, 'heading', e.target.value)}
                        className="w-full input text-sm bg-white"
                      />
                      <FieldError message={submitted || link.heading ? rowErrors.heading : null} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">URL</label>
                      <input
                        type="url"
                        value={link.url}
                        onChange={(e) => updateLinkRow(index, 'url', e.target.value)}
                        className="w-full input text-sm bg-white"
                      />
                      <FieldError message={submitted || link.url ? rowErrors.url : null} />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLinkRow(index)}
                      className="sm:mt-5 inline-flex items-center justify-center w-10 h-10 rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50"
                      aria-label="Remove link"
                    >
                      <HiOutlineTrash size={18} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="font-bold text-slate-900">Resume</h2>
              <span className="text-sm text-slate-600">1 active resume</span>
            </div>

            {visibleResumes.length > 0 ? (
              <div className="mb-6 space-y-3">
                {visibleResumes.map((resume) => {
                  const isViewing = viewingResumeIds.has(resume.resumeId);
                  const isDownloading = downloadingResumeIds.has(resume.resumeId);

                  return (
                    <div
                      key={resume.resumeId}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border rounded-xl p-3 ${previewResume?.resumeId === resume.resumeId
                        ? 'border-blue-200 bg-blue-50'
                        : 'border-slate-200 bg-slate-50'
                        }`}
                    >
                      <button type="button" onClick={() => setPreviewResumeId(resume.resumeId)} className="flex items-center gap-3 text-left min-w-0">
                        <HiOutlineDocumentText size={22} className="text-blue-600 shrink-0" />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-slate-900 truncate">Resume.pdf</span>
                          <span className="block text-xs text-slate-400">
                            {Math.ceil(Number(resume.size || 0) / 1024)}KB
                          </span>
                        </span>
                      </button>
                      <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 mt-3 sm:mt-0 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => openResume(resume)}
                          disabled={isViewing}
                          className={`w-full sm:w-auto justify-center inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 font-medium hover:bg-blue-100 ${isViewing ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          {isViewing ? (
                            <div className="w-4 h-4 border-2 border-blue-700 border-t-transparent rounded-full animate-spin shrink-0" />
                          ) : (
                            <HiOutlineDocumentText size={16} />
                          )}
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => openResume(resume, true)}
                          disabled={isDownloading}
                          className={`w-full sm:w-auto justify-center inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 font-medium hover:bg-slate-100 ${isDownloading ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          {isDownloading ? (
                            <div className="w-4 h-4 border-2 border-slate-700 border-t-transparent rounded-full animate-spin shrink-0" />
                          ) : (
                            <HiOutlineDocumentText size={16} />
                          )}
                          Download
                        </button>
                        <label className="w-full sm:w-auto justify-center inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 font-medium hover:bg-slate-100 cursor-pointer">
                          <HiOutlineUpload size={16} /> Replace
                          <input
                            type="file"
                            accept=".pdf"
                            onChange={(event) => handleResumeReplace(resume.resumeId, event.target.files[0], event.target)}
                            className="hidden"
                            disabled={uploading}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => handleRemoveResume(resume.resumeId)}
                          className="w-full sm:w-auto justify-center inline-flex items-center gap-1.5 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 font-medium hover:bg-red-100"
                        >
                          <HiOutlineX size={16} /> Delete
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-600 mb-6">No Resume Uploaded</p>
            )}
            <label
              className={`flex items-center justify-center gap-2 px-4 py-8 border-2 border-dashed rounded-xl transition-colors ${uploading
                ? 'border-slate-200 bg-slate-50 cursor-not-allowed'
                : 'border-slate-300 hover:border-blue-500 hover:bg-blue-50 cursor-pointer'
                }`}
            >
              <HiOutlineUpload size={20} className="text-slate-500" />
              <span className="text-sm text-slate-600">
                {uploading
                  ? 'Uploading...'
                  : visibleResumes.length > 0
                    ? 'Replace PDF (max 1MB)'
                    : 'Upload PDF (max 1MB)'}
              </span>
              <input
                type="file"
                accept=".pdf"
                onChange={handleResumeUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={saving || uploading || !hasChanges || hasValidationErrors(errors)}
            className="w-full btn-primary disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>

          <div className="lg:hidden mt-8 pt-6 pb-8 border-t border-slate-200/80">
            <button
              type="button"
              onClick={() => setShowLogoutModal(true)}
              className="w-full flex items-center justify-center gap-2.5 px-4 py-3 text-slate-700 hover:text-red-600 bg-white hover:bg-red-50/60 rounded-xl font-semibold text-sm border border-slate-200/90 hover:border-red-200/80 shadow-2xs transition-all duration-150 group"
            >
              <HiOutlineLogout size={18} className="text-slate-400 group-hover:text-red-500 transition-colors" />
              <span>Log Out</span>
            </button>
          </div>
        </form>
      )}

      <LogoutConfirmModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
        loading={isLoggingOut}
      />
    </div>
  );
}
