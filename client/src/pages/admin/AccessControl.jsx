import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { HiOutlineBan, HiOutlineKey, HiOutlineTrash, HiOutlineCheckCircle, HiOutlineClipboardCheck, HiOutlineSearch, HiOutlineFilter, HiOutlineMail } from 'react-icons/hi';
import api, { showApiError } from '../../services/api';
import DeliveryEmailModal from '../../components/admin/DeliveryEmailModal';
import { handleApiResponse } from '../../utils/apiHandler';
import { useQueryClient } from '@tanstack/react-query';
import { ADMIN_JOBS_ROOT_KEY, APPLICATIONS_ROOT_KEY } from '../../services/queryClient';
import { SCHOOLS } from '../../utils/constants';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/rbac';
import BlocklistCsvModal from '../../components/admin/BlocklistCsvModal';
import ExportBlocklistModal from '../../components/admin/ExportBlocklistModal';
import { exportBlocklistExcel } from '../../services/adminService';

let latestRequestId = 0;

export default function AccessControl() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canWrite = hasPermission(user, 'accessControl', 'write');
  const [activeTab, setActiveTab] = useState('candidates');
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [blocklist, setBlocklist] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [reason, setReason] = useState('');
  const [selectedSchools, setSelectedSchools] = useState([]);
  const [selectedYears, setSelectedYears] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [tempSchools, setTempSchools] = useState([]);
  const [tempYears, setTempYears] = useState([]);
  const [tempReason, setTempReason] = useState('');
  const [schoolSearch, setSchoolSearch] = useState('');
  const [hrs, setHrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hrSearch, setHrSearch] = useState('');
  const [hrLoading, setHrLoading] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [blockReason, setBlockReason] = useState('None');
  const [resetModal, setResetModal] = useState({ open: false, hr: null });
  const [resetting, setResetting] = useState(false);

  const PAGE_SIZE = 50;
  const searchQuery = debouncedSearch.length >= 2 ? debouncedSearch : '';

  const ALLOWED_YEARS = useMemo(() => {
    const baseStart = 2026;
    const currentYear = new Date().getFullYear();
    const start = Math.max(baseStart, currentYear);
    const end = start + 10;
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, []);

  const activeFilterCount = (selectedSchools.length > 0 ? 1 : 0) + (selectedYears.length > 0 ? 1 : 0) + (reason && reason !== 'None' ? 1 : 0);

  const openFilters = () => {
    setTempSchools([...selectedSchools]);
    setTempYears([...selectedYears]);
    setTempReason(reason);
    setSchoolSearch('');
    setShowFilters(true);
  };

  const applyFilters = () => {
    setSelectedSchools(tempSchools);
    setSelectedYears(tempYears);
    setReason(tempReason);
    setPage(1);
    setShowFilters(false);
  };

  const clearFilters = () => {
    setSelectedSchools([]);
    setSelectedYears([]);
    setReason('');
    setTempSchools([]);
    setTempYears([]);
    setTempReason('');
    setSchoolSearch('');
    setPage(1);
    setShowFilters(false);
  };

  const toggleTempSchool = (s) => setTempSchools(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  const toggleTempYear = (y) => setTempYears(prev => prev.includes(y) ? prev.filter(x => x !== y) : [...prev, y]);

  const fetchBlocklist = async () => {
    const requestId = ++latestRequestId;
    setLoading(true);
    try {
      const res = await api.get('/admin/blocklist-v2', {
        params: {
          page,
          limit: PAGE_SIZE,
          search: searchQuery,
          reason,
          schools: selectedSchools.join(','),
          graduationYears: selectedYears.join(',')
        }
      });
      if (requestId !== latestRequestId) return;
      const data = res.data;
      setBlocklist(data.items);
      setTotal(data.total);
    } catch (error) {
      if (requestId !== latestRequestId) return;
      showApiError(error, 'Failed to fetch blocklist');
    } finally {
      if (requestId === latestRequestId) {
        setLoading(false);
      }
    }
  };

  const fetchHrs = async () => {
    setHrLoading(true);
    try {
      const res = await api.get('/admin/hr');
      setHrs(handleApiResponse(res));
    } catch (error) {
      showApiError(error, 'Failed to fetch HRs');
    } finally {
      setHrLoading(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      setPage(1);
      setDebouncedSearch(search);
    }, 400);

    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    if (activeTab === 'candidates') {
      fetchBlocklist();
    }
  }, [activeTab, page, debouncedSearch, reason, selectedSchools, selectedYears]);

  useEffect(() => {
    setPage(1);
  }, [selectedSchools, selectedYears]);

  useEffect(() => {
    if (activeTab === 'hrs') {
      fetchHrs();
    }
  }, [activeTab]);

  const handleAddBlock = async (e) => {
    e.preventDefault();
    const trimmed = String(newEmail || '').trim();
    if (!trimmed || !trimmed.includes('@')) {
      toast.error('Enter a valid email');
      return;
    }
    try {
      await api.post('/admin/access-control', { email: trimmed, reason: blockReason });
      toast.success('Email blocked');
      setNewEmail('');
      setBlockReason('None');
      fetchBlocklist();
    } catch (err) {
      showApiError(err, 'Failed to add to blocklist');
    }
  };

  const handleExportBlocklist = async (filters) => {
    try {
      setIsExporting(true);
      const res = await exportBlocklistExcel(filters);
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const contentDisposition = res.headers['content-disposition'];
      let filename = 'PlaceHub_Candidate_Blocklist.xlsx';
      if (contentDisposition && contentDisposition.includes('filename=')) {
        filename = contentDisposition.split('filename=')[1].replace(/"/g, '');
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Blocklist exported successfully');
      setShowExportModal(false);
    } catch (err) {
      showApiError(err, 'Failed to export blocklist');
    } finally {
      setIsExporting(false);
    }
  };

  const handleToggleBlock = async (id, isBlocked) => {
    try {
      await api.put(`/admin/access-control/${id}/status`, { isBlocked: !isBlocked });
      toast.success(isBlocked ? 'Email unblocked' : 'Email blocked');
      fetchBlocklist();
    } catch (error) {
      showApiError(error, 'Failed to update status');
    }
  };

  const handleRemoveBlock = async (id) => {
    if (!window.confirm('Are you sure you want to completely remove this email from the blocklist?')) return;
    try {
      await api.delete(`/admin/access-control/${id}`);
      toast.success('Email removed from blocklist');
      fetchBlocklist();
    } catch (error) {
      showApiError(error, 'Failed to remove email');
    }
  };

  const handleToggleHr = async (id, isActive) => {
    try {
      await api.put(`/admin/hr/${id}/status`, { isActive: !isActive });
      toast.success(isActive ? 'HR Account Blocked' : 'HR Account Unblocked');
      fetchHrs();
    } catch (error) {
      showApiError(error, 'Failed to update HR status');
    }
  };

  const handleResetPassword = async (deliveryEmail) => {
    const hr = resetModal.hr;
    if (!hr) return;

    setResetting(true);
    try {
      await api.post(`/admin/hr/${hr._id}/reset-password`, { deliveryEmail });
      toast.success('Password reset — credentials emailed');
      setResetModal({ open: false, hr: null });
      fetchHrs();
      queryClient.invalidateQueries({ queryKey: ADMIN_JOBS_ROOT_KEY });
      queryClient.invalidateQueries({ queryKey: APPLICATIONS_ROOT_KEY });
    } catch (error) {
      showApiError(error, 'Failed to reset password');
    } finally {
      setResetting(false);
    }
  };

  const handleDeleteHr = async (id) => {
    if (!window.confirm('Are you sure you want to permanently delete this HR account?')) return;
    try {
      await api.delete(`/admin/hr/${id}`);
      toast.success('HR Account deleted');
      fetchHrs();
      queryClient.invalidateQueries({ queryKey: ADMIN_JOBS_ROOT_KEY });
      queryClient.invalidateQueries({ queryKey: APPLICATIONS_ROOT_KEY });
    } catch (error) {
      showApiError(error, 'Failed to delete HR');
    }
  };

  const filteredHrs = useMemo(() => {
    if (!hrSearch.trim()) return hrs;
    const lower = hrSearch.trim().toLowerCase();
    return hrs.filter((hr) => {
      const companyMatch = hr.companyId?.name?.toLowerCase().includes(lower);
      const jobMatch = hr.jobId?.title?.toLowerCase().includes(lower);
      const usernameMatch = hr.username?.toLowerCase().includes(lower);
      return companyMatch || jobMatch || usernameMatch;
    });
  }, [hrs, hrSearch]);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
          <HiOutlineClipboardCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Access Control</h1>
          <p className="text-sm text-slate-600 mt-0.5">Control system-wide access and restrictions.</p>
        </div>
      </div>

      <div className="flex border-b border-slate-200">
        <button
          className={`py-3 px-6 text-sm font-medium border-b-2 transition-colors ${activeTab === 'candidates' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('candidates')}
        >
          Candidate Blocklist
        </button>
        <button
          className={`py-3 px-6 text-sm font-medium border-b-2 transition-colors ${activeTab === 'hrs' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('hrs')}
        >
          HR Management
        </button>
      </div>

      {activeTab === 'candidates' && (
        <div className="space-y-5 pt-2">
          {/* Block Email Grouped Action */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-3">
              <p className="text-sm text-slate-600 font-medium">Only student accounts or unregistered emails can be blocked.</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowExportModal(true)}
                  className="h-9 px-4 flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm whitespace-nowrap"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Export to Excel
                </button>
                {canWrite && (
                  <button
                    onClick={() => setShowCsvModal(true)}
                    className="h-9 px-4 flex items-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition-colors shadow-sm whitespace-nowrap"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload CSV
                  </button>
                )}
              </div>
            </div>
            {canWrite && (
              <form onSubmit={handleAddBlock} className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative w-full sm:w-64">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <HiOutlineMail className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="student@example.com"
                    autoComplete="email"
                    className="h-10 w-full pl-9 pr-3 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm bg-white"
                    required
                  />
                </div>
                <div className="flex w-full sm:w-auto gap-3">
                  <div className="relative w-full sm:w-48">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <HiOutlineBan className="h-4 w-4 text-slate-400" />
                    </div>
                    <select
                      value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                      className="h-10 w-full pl-9 pr-8 border border-slate-300 rounded-lg text-sm font-sans text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm appearance-none cursor-pointer"
                    >
                      <option value="None">None</option>
                      <option value="Placed">Placed</option>
                      <option value="Unauthorised">Unauthorised</option>
                      <option value="Opted Out">Opted Out</option>
                      <option value="Active Backlogs">Active Backlogs</option>
                      <option value="Low CGPA">Low CGPA</option>
                      <option value="DC">DC</option>
                      <option value="Other">Other</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  <button type="submit" className="h-10 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap">
                    Block Email
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Search Section */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <HiOutlineSearch className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search email or admission ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-10 w-full pl-9 pr-3 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm bg-white"
                />
              </div>

              <div className="relative">
                <button
                  onClick={showFilters ? () => setShowFilters(false) : openFilters}
                  className={`h-10 px-4 flex items-center gap-2 border rounded-lg text-sm font-medium transition-colors shadow-sm ${activeFilterCount > 0 ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                >
                  <HiOutlineFilter className="h-4 w-4" />
                  Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
                </button>

                {showFilters && (
                  <>
                    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowFilters(false)} />
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden pointer-events-auto flex flex-col max-h-[85vh]">

                        <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
                          <h2 className="text-lg font-semibold text-slate-900">Candidate Filters</h2>
                          <button onClick={() => setShowFilters(false)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-8 flex-1">

                          <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-slate-900">School</h3>
                            <div className="relative">
                              <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                              <input
                                type="text"
                                placeholder="Search schools..."
                                value={schoolSearch}
                                onChange={(e) => setSchoolSearch(e.target.value)}
                                className="w-full h-10 pl-9 pr-3 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm"
                              />
                            </div>
                            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1 bg-slate-50/50">
                              {SCHOOLS.filter(s => s.toLowerCase().includes(schoolSearch.toLowerCase())).map((school) => (
                                <label key={school} className="flex items-center gap-3 p-1.5 cursor-pointer rounded-md hover:bg-white hover:shadow-sm transition-all group">
                                  <div className="relative flex items-center justify-center shrink-0">
                                    <input
                                      type="checkbox"
                                      className="peer appearance-none w-4 h-4 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 checked:bg-blue-600 checked:border-blue-600 transition-all cursor-pointer"
                                      checked={tempSchools.includes(school)}
                                      onChange={() => toggleTempSchool(school)}
                                    />
                                    <svg className="absolute w-3 h-3 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M11.6667 3.5L5.25001 9.91667L2.33334 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  </div>
                                  <span className="text-sm text-slate-700 group-hover:text-slate-900 select-none leading-tight">{school}</span>
                                </label>
                              ))}
                              {SCHOOLS.filter(s => s.toLowerCase().includes(schoolSearch.toLowerCase())).length === 0 && (
                                <div className="p-4 text-center text-sm text-slate-500">No schools found.</div>
                              )}
                            </div>
                          </div>

                          <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-slate-900">Graduation Year</h3>
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                              {ALLOWED_YEARS.map((year) => (
                                <label key={year} className="flex items-center gap-2 p-2.5 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors group">
                                  <div className="relative flex items-center justify-center shrink-0">
                                    <input
                                      type="checkbox"
                                      className="peer appearance-none w-4 h-4 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 checked:bg-blue-600 checked:border-blue-600 transition-all cursor-pointer"
                                      checked={tempYears.includes(year)}
                                      onChange={() => toggleTempYear(year)}
                                    />
                                    <svg className="absolute w-3 h-3 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M11.6667 3.5L5.25001 9.91667L2.33334 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  </div>
                                  <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 select-none">{year}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-slate-900">Reason</h3>
                            <div className="relative">
                              <select
                                value={tempReason}
                                onChange={(e) => setTempReason(e.target.value)}
                                className="w-full h-10 pl-3 pr-8 border border-slate-300 rounded-lg text-sm font-sans text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm appearance-none cursor-pointer"
                              >
                                <option value="">All Reasons</option>
                                <option value="None">None</option>
                                <option value="Placed">Placed</option>
                                <option value="Unauthorised">Unauthorised</option>
                                <option value="Opted Out">Opted Out</option>
                                <option value="Active Backlogs">Active Backlogs</option>
                                <option value="Low CGPA">Low CGPA</option>
                                <option value="DC">DC</option>
                                <option value="Other">Other</option>
                              </select>
                              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </div>
                          </div>

                        </div>

                        <div className="p-5 bg-slate-50 border-t border-slate-100 flex justify-between items-center shrink-0">
                          <button
                            onClick={clearFilters}
                            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 rounded-lg transition-colors"
                          >
                            Clear All
                          </button>
                          <button
                            onClick={applyFilters}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                          >
                            Apply Filters
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <span className="text-sm text-slate-600 self-start sm:self-center">
              Showing{' '}
              {total === 0 ? (
                <>
                  <span className="font-medium text-slate-900">0</span> of <span className="font-medium text-slate-900">0</span>
                </>
              ) : (
                <>
                  <span className="font-medium text-slate-900">{((page - 1) * PAGE_SIZE) + 1}</span>
                  –
                  <span className="font-medium text-slate-900">{Math.min(page * PAGE_SIZE, total)}</span> of <span className="font-medium text-slate-900">{total}</span>
                </>
              )}{' '}
              candidate{total === 1 ? '' : 's'}
            </span>
          </div>

          {loading && (
            <div className="flex justify-center py-2"><div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5 font-semibold text-slate-700">Admission ID</th>
                  <th className="px-6 py-3.5 font-semibold text-slate-700">Email</th>
                  <th className="px-6 py-3.5 font-semibold text-slate-700">School</th>
                  <th className="px-6 py-3.5 font-semibold text-slate-700">Graduation Year</th>
                  <th className="px-6 py-3.5 font-semibold text-slate-700">Status</th>
                  <th className="px-6 py-3.5 font-semibold text-slate-700">Reason</th>
                  <th className="px-6 py-3.5 font-semibold text-slate-700 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(!blocklist || blocklist.length === 0) ? (
                  <tr><td colSpan="7" className="px-6 py-8 text-center text-slate-500">No emails in blocklist</td></tr>
                ) : (
                  (blocklist || []).map((item) => (
                    <tr key={item._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900">{item.admissionId || 'N/A'}</td>
                      <td className="px-6 py-4 text-slate-600">{item.email}</td>
                      <td className="px-6 py-4 text-slate-600">{item.school || 'N/A'}</td>
                      <td className="px-6 py-4 text-slate-600">{item.graduationYear || 'N/A'}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${item.isBlocked ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                          {item.isBlocked ? 'Blocked' : 'Unblocked'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{item.reason || 'None'}</td>
                      <td className="px-6 py-4 text-right">
                        {canWrite && (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleToggleBlock(item._id, item.isBlocked)}
                              className="p-2 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition-colors"
                              title={item.isBlocked ? 'Unblock' : 'Block'}
                            >
                              {item.isBlocked ? <HiOutlineCheckCircle size={20} /> : <HiOutlineBan size={20} />}
                            </button>
                            <button
                              onClick={() => handleRemoveBlock(item._id)}
                              className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 transition-colors"
                              title="Remove"
                            >
                              <HiOutlineTrash size={20} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div className="flex flex-col sm:flex-row items-center justify-end px-6 py-4 border-t border-slate-200 bg-slate-50/50 gap-4">
              <div className="flex gap-2">
                <button
                  className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-slate-700 transition-colors shadow-sm"
                  disabled={page === 1 || total === 0}
                  onClick={() => setPage(page - 1)}
                >
                  Prev
                </button>
                <button
                  className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-slate-700 transition-colors shadow-sm"
                  disabled={page >= Math.ceil(total / PAGE_SIZE) || total === 0}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          <BlocklistCsvModal
            isOpen={showCsvModal}
            onClose={() => {
              setShowCsvModal(false);
              fetchBlocklist();
            }}
          />
          <ExportBlocklistModal
            isOpen={showExportModal}
            onClose={() => setShowExportModal(false)}
            onExport={handleExportBlocklist}
            isExporting={isExporting}
          />
        </div>
      )}

      {activeTab === 'hrs' && (
        <>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div className="relative w-full sm:w-80">
              <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search by company, job or username..."
                value={hrSearch}
                onChange={(e) => setHrSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              />
            </div>
            <div className="text-sm text-slate-600">
              Showing{' '}
              {filteredHrs.length === 0 ? (
                <>
                  <span className="font-medium text-slate-900">0</span> of <span className="font-medium text-slate-900">0</span>
                </>
              ) : (
                <>
                  <span className="font-medium text-slate-900">1</span>
                  –
                  <span className="font-medium text-slate-900">{filteredHrs.length}</span> of <span className="font-medium text-slate-900">{filteredHrs.length}</span>
                </>
              )}{' '}
              HR account{filteredHrs.length === 1 ? '' : 's'}
            </div>
          </div>
          {hrLoading && (
            <div className="flex justify-center py-2"><div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
          )}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-medium text-slate-900">HR Name</th>
                  <th className="px-6 py-4 font-medium text-slate-900">Company</th>
                  <th className="px-6 py-4 font-medium text-slate-900">Job</th>
                  <th className="px-6 py-4 font-medium text-slate-900">Username</th>
                  <th className="px-6 py-4 font-medium text-slate-900">Status</th>
                  <th className="px-6 py-4 font-medium text-slate-900 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredHrs.length === 0 ? (
                  <tr><td colSpan="6" className="px-6 py-8 text-center text-slate-500">No HR accounts found</td></tr>
                ) : (
                  filteredHrs.map((hr) => (
                    <tr key={hr._id}>
                      <td className="px-6 py-4 font-medium">{hr.name}</td>
                      <td className="px-6 py-4">{hr.companyId?.name || 'N/A'}</td>
                      <td className="px-6 py-4 text-slate-600">{hr.jobId?.title || 'N/A'}</td>
                      <td className="px-6 py-4 text-slate-500">{hr.username}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${hr.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {hr.isActive ? 'Active' : 'Blocked'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {canWrite && (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleToggleHr(hr._id, hr.isActive)}
                              className="p-2 text-slate-400 hover:text-orange-600 rounded-lg hover:bg-slate-100 transition-colors"
                              title={hr.isActive ? 'Block HR' : 'Unblock HR'}
                            >
                              {hr.isActive ? <HiOutlineBan size={20} /> : <HiOutlineCheckCircle size={20} />}
                            </button>
                            <button
                              onClick={() => setResetModal({ open: true, hr })}
                              className="p-2 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition-colors"
                              title="Reset Password"
                            >
                              <HiOutlineKey size={20} />
                            </button>
                            <button
                              onClick={() => handleDeleteHr(hr._id)}
                              className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 transition-colors"
                              title="Delete HR"
                            >
                              <HiOutlineTrash size={20} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <DeliveryEmailModal
        open={resetModal.open}
        title="Reset HR Password"
        description="Credentials will be sent to this email. Current sessions will be invalidated."
        confirmLabel="Reset & Send"
        loading={resetting}
        defaultEmail={resetModal.hr?.deliveryEmail || ''}
        onSubmit={handleResetPassword}
        onCancel={() => !resetting && setResetModal({ open: false, hr: null })}
      />
    </div>
  );
}
