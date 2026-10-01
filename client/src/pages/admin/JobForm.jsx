import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { createJob, getJobById, updateJob } from '../../services/jobService';
import {
  ADMIN_JOBS_ROOT_KEY,
  APPLICATIONS_ROOT_KEY,
  DASHBOARD_QUERY_KEY,
  JOBS_ROOT_KEY,
  SAVED_JOBS_KEY,
} from '../../services/queryClient';
import toast from 'react-hot-toast';
import { showApiError } from '../../services/api';
import { handleApiResponse } from '../../utils/apiHandler';
import { HiOutlineX, HiOutlinePhotograph, HiOutlinePlus, HiOutlineTrash, HiOutlineBriefcase, HiOutlineCheck, HiOutlinePaperClip } from 'react-icons/hi';
import { SCHOOLS } from '../../utils/constants';
import JobAttachments from '../../components/job/JobAttachments';
import JobDescriptionEditor from '../../components/admin/JobDescriptionEditor';
export default function JobForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const [createdJobId, setCreatedJobId] = useState(null);
  const [form, setForm] = useState({
    title: '',
    company: '',
    description: '',
    location: '',
    jobType: 'Full-time',
    salary: '',
    skills: [],
    deadlineDate: '',
    deadlineHour: '',
    deadlineMinute: '',
    deadlinePeriod: '',
    requirements: [],
    eligibleSchools: [],
    graduationYears: [],
    rounds: [{ name: '', description: '' }],
  });

  const roundNameRefs = useRef([]);
  const roundDescRefs = useRef([]);
  const focusNewRoundIndex = useRef(null);

  useEffect(() => {
    if (focusNewRoundIndex.current !== null) {
      const idx = focusNewRoundIndex.current;
      focusNewRoundIndex.current = null;
      if (roundNameRefs.current[idx]) {
        roundNameRefs.current[idx].focus();
      }
    }
  }, [form.rounds.length]);
  const [skillInput, setSkillInput] = useState('');
  const [reqInput, setReqInput] = useState('');
  const [gradYearInput, setGradYearInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [existingLogo, setExistingLogo] = useState('');
  const [removeLogo, setRemoveLogo] = useState(false);

  useEffect(() => {
    if (isEdit) {
      setCreatedJobId(null);
      setFetching(true);
      fetchJob();
    }
  }, [id]);

  const fetchJob = async () => {
    try {
      const response = await getJobById(id);
      const data = handleApiResponse(response);

      let parsedDate = '';
      let parsedHour = '12';
      let parsedMinute = '00';
      let parsedPeriod = 'AM';

      if (data.deadline) {
        const d = new Date(data.deadline);
        const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true };
        const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(d);

        const y = parts.find(p => p.type === 'year')?.value;
        const m = parts.find(p => p.type === 'month')?.value;
        const day = parts.find(p => p.type === 'day')?.value;
        parsedDate = `${y}-${m}-${day}`;

        let hr = parts.find(p => p.type === 'hour')?.value;
        if (hr === '00' || hr === '0') hr = '12';
        else if (hr.length === 1) hr = `0${hr}`;

        parsedHour = parseInt(hr, 10).toString();

        let min = parts.find(p => p.type === 'minute')?.value;
        if (min.length === 1) min = `0${min}`;
        parsedMinute = min;

        const ampm = parts.find(p => p.type === 'dayPeriod')?.value;
        if (ampm) parsedPeriod = ampm.toUpperCase();
      }

      setForm({
        title: data.title,
        company: data.company,
        description: data.description,
        location: data.location,
        jobType: data.jobType,
        salary: data.salary || '',
        skills: data.skills || [],
        deadlineDate: parsedDate,
        deadlineHour: parsedHour,
        deadlineMinute: parsedMinute,
        deadlinePeriod: parsedPeriod,
        requirements: data.requirements || [],
        eligibleSchools: data.eligibleSchools || [],
        graduationYears: data.graduationYears || [],
        rounds: (data.rounds && data.rounds.length)
          ? data.rounds.map(r => ({ name: r.name || '', description: r.description || '' }))
          : [{ name: '', description: '' }],
      });
      if (data.logo) setExistingLogo(data.logo);
    } catch (err) {
      showApiError(err, 'Failed to load job');
    } finally {
      setFetching(false);
    }
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
      setRemoveLogo(false);
    }
    e.target.value = '';
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview('');
    setExistingLogo('');
    setRemoveLogo(true);
  };

  const addSkill = () => {
    const skillsToAdd = skillInput.split(',').map(s => s.trim()).filter(Boolean);
    const newUniqueSkills = [...new Set(skillsToAdd.filter(s => !form.skills.includes(s)))];

    if (newUniqueSkills.length > 0) {
      setForm({ ...form, skills: [...form.skills, ...newUniqueSkills] });
      setSkillInput('');
    }
  };

  const addReq = () => {
    const req = reqInput.trim();
    if (req) {
      setForm({ ...form, requirements: [...form.requirements, req] });
      setReqInput('');
    }
  };

  const handleAddGradYear = () => {
    const year = parseInt(gradYearInput, 10);
    if (!year || year < 2000 || year > 2100) return;
    if (form.graduationYears.includes(year)) return;
    setForm(prev => ({
      ...prev,
      graduationYears: [...prev.graduationYears, year]
    }));
    setGradYearInput('');
  };

  const handleRemoveGradYear = (year) => {
    setForm(prev => ({
      ...prev,
      graduationYears: prev.graduationYears.filter(y => y !== year)
    }));
  };

  // --- Rounds helpers ---
  const addRound = () => {
    setForm({ ...form, rounds: [...form.rounds, { name: '', description: '' }] });
  };

  const removeRound = (index) => {
    if (form.rounds.length <= 1) {
      toast.error('At least one round is required');
      return;
    }
    setForm({ ...form, rounds: form.rounds.filter((_, i) => i !== index) });
  };

  const updateRound = (index, field, value) => {
    const updated = form.rounds.map((r, i) =>
      i === index ? { ...r, [field]: value } : r
    );
    setForm({ ...form, rounds: updated });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate rounds before submit
    if (!form.rounds.length) {
      toast.error('At least one hiring round is required');
      return;
    }
    const emptyRound = form.rounds.find(r => !r.name.trim());
    if (emptyRound) {
      toast.error('All rounds must have a name');
      return;
    }

    // Validate deadline components
    if (!form.deadlineDate || !form.deadlineHour || !form.deadlineMinute || !form.deadlinePeriod) {
      toast.error('Complete deadline date and time must be selected');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('title', form.title);
      formData.append('company', form.company);
      formData.append('description', form.description);
      formData.append('location', form.location);
      formData.append('jobType', form.jobType);
      formData.append('salary', form.salary);

      let finalDeadline = '';
      if (form.deadlineDate) {
        if (form.deadlineMinute === '' || form.deadlineMinute < 0 || form.deadlineMinute > 59) {
          toast.error('Invalid deadline minute. Must be 0-59.');
          setLoading(false);
          return;
        }

        let hr = parseInt(form.deadlineHour, 10);
        if (form.deadlinePeriod === 'PM' && hr !== 12) hr += 12;
        if (form.deadlinePeriod === 'AM' && hr === 12) hr = 0;

        const pad = (n) => n.toString().padStart(2, '0');
        const minute = String(form.deadlineMinute).padStart(2, '0');
        const localDateString = `${form.deadlineDate}T${pad(hr)}:${minute}:00+05:30`;
        const localDate = new Date(localDateString);
        finalDeadline = localDate.toISOString();
      }

      formData.append('deadline', finalDeadline);
      formData.append('skills', JSON.stringify(form.skills));
      formData.append('requirements', JSON.stringify(form.requirements));
      formData.append('eligibleSchools', JSON.stringify(form.eligibleSchools));
      formData.append('graduationYears', JSON.stringify(form.graduationYears));

      // Serialize rounds with auto-assigned sequential order
      const roundsPayload = form.rounds.map((r, i) => ({
        name: r.name.trim(),
        description: r.description.trim(),
        order: i + 1,
      }));
      formData.append('rounds', JSON.stringify(roundsPayload));

      if (logoFile) {
        formData.append('logo', logoFile);
      }
      if (removeLogo) {
        formData.append('removeLogo', 'true');
      }

      if (isEdit) {
        await updateJob(id, formData);
        toast.success('Job updated!');
        queryClient.invalidateQueries({ queryKey: ADMIN_JOBS_ROOT_KEY });
        queryClient.invalidateQueries({ queryKey: JOBS_ROOT_KEY });
        queryClient.invalidateQueries({ queryKey: APPLICATIONS_ROOT_KEY });
        queryClient.invalidateQueries({ queryKey: SAVED_JOBS_KEY });
        queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
        navigate('/admin/jobs');
      } else {
        const response = await createJob(formData);
        toast.success('Job created successfully!');
        queryClient.invalidateQueries({ queryKey: ADMIN_JOBS_ROOT_KEY });
        queryClient.invalidateQueries({ queryKey: JOBS_ROOT_KEY });
        queryClient.invalidateQueries({ queryKey: APPLICATIONS_ROOT_KEY });
        queryClient.invalidateQueries({ queryKey: SAVED_JOBS_KEY });
        queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });

        const newJobId = response?.data?.data?._id;

        if (!newJobId) {
          throw new Error('Failed to retrieve job ID from server response.');
        }

        setCreatedJobId(newJobId);
      }
    } catch (error) {
      showApiError(error, 'Failed to save job');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (createdJobId) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-5">
            <HiOutlineCheck size={32} />
          </div>
          <h2 className="text-2xl font-semibold text-slate-900 mb-3">Job Created Successfully!</h2>
          <p className="text-slate-500 mb-8 max-w-md mx-auto">
            Your job posting is ready. You can now add supporting documents such as the JD, guidelines, or sample papers for students.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/admin/jobs')}
              className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors"
            >
              Not Now, Go to Jobs
            </button>
            <button
              onClick={() => navigate(`/admin/jobs/${createdJobId}/edit`, { replace: true })}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              <HiOutlinePaperClip size={18} />
              Add Attachments
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-start gap-3 mb-8">
        <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
          <HiOutlineBriefcase className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
            {isEdit ? 'Edit Job' : 'Add New Job'}
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">Create or edit a placement opportunity.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Details */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Job Title *</label>
              <input type="text" name="title" value={form.title} onChange={handleChange} required
                disabled={isEdit}
                className={`w-full input text-sm ${isEdit ? 'opacity-60 bg-slate-100 cursor-not-allowed' : ''}`} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Company *</label>
              <input type="text" name="company" value={form.company} onChange={handleChange} required
                disabled={isEdit}
                className={`w-full input text-sm ${isEdit ? 'opacity-60 bg-slate-100 cursor-not-allowed' : ''}`} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Location *</label>
              <input type="text" name="location" value={form.location} onChange={handleChange} required
                className="w-full input text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Job Type *</label>
              <select name="jobType" value={form.jobType} onChange={handleChange}
                className="w-full input text-sm">
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Internship">Internship</option>
                <option value="Contract">Contract</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Salary</label>
              <input type="text" name="salary" value={form.salary} onChange={handleChange} placeholder="e.g., 5-8 LPA"
                className="w-full input text-sm" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Deadline *</label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="date"
                  name="deadlineDate"
                  value={form.deadlineDate}
                  onChange={handleChange}
                  required
                  className="input text-sm flex-1"
                />
                <div className="flex gap-2">
                  <select
                    name="deadlineHour"
                    value={form.deadlineHour}
                    onChange={handleChange}
                    className="input text-sm w-20"
                  >
                    <option value="" disabled>HH</option>
                    {[...Array(12)].map((_, i) => {
                      const h = (i + 1).toString();
                      return <option key={h} value={h}>{h.padStart(2, '0')}</option>;
                    })}
                  </select>
                  <span className="text-slate-500 self-center">:</span>
                  <input
                    type="number"
                    name="deadlineMinute"
                    value={form.deadlineMinute}
                    onChange={handleChange}
                    min="0"
                    max="59"
                    placeholder="MM"
                    className="input text-sm w-20"
                  />
                  <select
                    name="deadlinePeriod"
                    value={form.deadlinePeriod}
                    onChange={handleChange}
                    className="input text-sm w-24"
                  >
                    <option value="" disabled>AM/PM</option>
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="sm:col-span-2">
              <JobDescriptionEditor
                value={form.description}
                onChange={(val) => setForm(f => ({ ...f, description: val }))}
              />
            </div>

            {/* Company Logo Upload */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Company Logo (optional)</label>
              <div className="flex items-center gap-4">
                {(logoPreview || (existingLogo && !removeLogo)) && (
                  <div className="relative">
                    <img
                      src={logoPreview || existingLogo}
                      alt="Logo preview"
                      className="w-16 h-16 object-contain rounded-lg border border-slate-200 bg-white p-1"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                      title="Remove Logo"
                    >
                      <HiOutlineX size={12} />
                    </button>
                  </div>
                )}
                <div className="flex-1">
                  <label className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 cursor-pointer hover:bg-slate-100 transition-colors w-fit">
                    <HiOutlinePhotograph size={18} />
                    {logoPreview || (existingLogo && !removeLogo) ? 'Replace Logo' : 'Upload Logo'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg"
                      onChange={handleLogoChange}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-slate-800 mt-1">PNG, JPG, or JPEG. Max 150 KB.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Skills */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3 mb-4">Required Skills *</h3>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
              placeholder="Add skill"
              className="flex-1 input text-sm"
            />
            <button type="button" onClick={addSkill} className="px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors">
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {form.skills.map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white border border-blue-700 rounded-full text-sm font-medium">
                {s}
                <button type="button" onClick={() => setForm({ ...form, skills: form.skills.filter((_, idx) => idx !== i) })} className="hover:text-red-600">
                  <HiOutlineX size={14} />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Requirements */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3 mb-4">Requirements</h3>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={reqInput}
              onChange={(e) => setReqInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addReq(); } }}
              placeholder="Add requirement"
              className="flex-1 input text-sm"
            />
            <button type="button" onClick={addReq} className="px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors">
              Add
            </button>
          </div>
          <ul className="space-y-2">
            {form.requirements.map((r, i) => (
              <li key={i} className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
                {r}
                <button type="button" onClick={() => setForm({ ...form, requirements: form.requirements.filter((_, idx) => idx !== i) })} className="text-slate-500 hover:text-red-600">
                  <HiOutlineX size={14} />
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Hiring Rounds */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex justify-between items-start border-b border-slate-100 pb-3 mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Hiring Rounds *</h3>
              <p className="text-sm text-slate-600 mt-0.5">Define the selection process stages. Order is determined by position.</p>
            </div>
            <button
              type="button"
              onClick={addRound}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white border border-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
            >
              <HiOutlinePlus size={16} />
              Add Round
            </button>
          </div>
          <div className="space-y-3">
            {form.rounds.map((round, index) => (
              <div key={index} className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="flex-shrink-0 w-7 h-7 flex items-center justify-center bg-blue-600 text-white text-xs font-bold rounded-full mt-1">
                  {index + 1}
                </span>
                <div className="flex-1 grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Round Name *</label>
                    <input
                      type="text"
                      ref={(el) => (roundNameRefs.current[index] = el)}
                      value={round.name}
                      onChange={(e) => updateRound(index, 'name', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (roundDescRefs.current[index]) {
                            roundDescRefs.current[index].focus();
                          }
                        }
                      }}
                      placeholder="e.g., Aptitude Test"
                      className="w-full input text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                    <input
                      type="text"
                      ref={(el) => (roundDescRefs.current[index] = el)}
                      value={round.description}
                      onChange={(e) => updateRound(index, 'description', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          focusNewRoundIndex.current = form.rounds.length;
                          addRound();
                        }
                      }}
                      placeholder="e.g., Online MCQ test"
                      className="w-full input text-sm"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeRound(index)}
                  className="flex-shrink-0 mt-6 p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title="Remove round"
                >
                  <HiOutlineTrash size={16} />
                </button>
              </div>
            ))}
          </div>
          {form.rounds.length === 0 && (
            <p className="text-sm text-red-500 mt-2">At least one round is required.</p>
          )}
        </div>

        {/* Eligible Schools */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex justify-between items-end border-b border-slate-100 pb-3 mb-4">
            <h3 className="text-base font-semibold text-slate-900">Eligible Schools</h3>
            <p className="text-sm text-slate-600 mb-1">Leave empty to allow all schools</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto p-2 border border-slate-100 rounded-lg bg-slate-50">
            {SCHOOLS.map((school) => (
              <label key={school} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.eligibleSchools.includes(school)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setForm({ ...form, eligibleSchools: [...form.eligibleSchools, school] });
                    } else {
                      setForm({ ...form, eligibleSchools: form.eligibleSchools.filter(s => s !== school) });
                    }
                  }}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                {school}
              </label>
            ))}
          </div>
        </div>

        {/* Eligible Graduation Years */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex justify-between items-end border-b border-slate-100 pb-3 mb-4">
            <h3 className="text-base font-semibold text-slate-900">Eligible Graduation Years</h3>
            <p className="text-sm text-slate-600 mb-1">Leave empty to allow all years</p>
          </div>
          <div className="flex gap-2 mb-3">
            <input
              type="number"
              value={gradYearInput}
              onChange={(e) => setGradYearInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddGradYear(); } }}
              placeholder="Enter year (e.g. 2027)"
              className="flex-1 input text-sm"
              min="2000"
              max="2100"
            />
            <button type="button" onClick={handleAddGradYear} className="px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors">
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {form.graduationYears.map((year, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white border border-blue-700 rounded-full text-sm font-medium">
                {year}
                <button type="button" onClick={() => handleRemoveGradYear(year)} className="hover:text-red-600">
                  <HiOutlineX size={14} />
                </button>
              </span>
            ))}
          </div>
        </div>

        <JobAttachments jobId={isEdit ? id : null} />

        <div className="pt-4">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? 'Saving...' : isEdit ? 'Update Job' : 'Create Job'}
          </button>
        </div>
      </form>
    </div>
  );
}
