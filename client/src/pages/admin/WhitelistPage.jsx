import { formatDate } from '../../utils/dateFormatter';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useWhitelist } from '../../hooks/useWhitelist';
import { HiOutlineMail, HiOutlineMinus, HiOutlinePlus, HiOutlineSearch, HiOutlineShieldCheck, HiOutlineTrash, HiOutlineUpload, HiOutlineX } from 'react-icons/hi';
import {
  getWhitelistStatus,
  updateConfig as toggleWhitelistApi,
  uploadWhitelistCsv,
  addManualWhitelist,
  bulkDeleteWhitelistEmails
} from '../../services/adminService';
import { getResponseData, showApiError } from '../../services/api';
import PaginationControls from '../../components/ui/PaginationControls';

const HighlightMatch = ({ text, highlight }) => {
  if (!highlight.trim()) return <span>{text}</span>;

  const safeRegex = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${safeRegex})`, 'gi');
  const parts = String(text).split(regex);

  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <span key={i} className="bg-yellow-200 text-yellow-900 font-medium">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
};

export default function WhitelistPage() {
  const queryClient = useQueryClient();
  const searchInputRef = useRef(null);

  // Pagination & Search State
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Whitelist Management State
  const [wlEnabled, setWlEnabled] = useState(false);
  const [wlUploading, setWlUploading] = useState(false);
  const [wlManualEmail, setWlManualEmail] = useState('');
  const [wlManualBusy, setWlManualBusy] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState([]);
  const [bulkDeleteBusy, setBulkDeleteBusy] = useState(false);

  // Fetch paginated data
  const { data, isLoading, isFetching, isError, error } = useWhitelist(debouncedSearch, page);

  const emails = Array.isArray(data?.emails) ? data.emails : [];
  const total = data?.pagination?.total || 0;
  const limit = data?.pagination?.limit || 50;
  const totalPages = data?.pagination?.totalPages || 1;

  // Management Methods
  const fetchWhitelistStatus = useCallback(async () => {
    try {
      const response = await getWhitelistStatus();
      const payload = getResponseData(response) || {};
      setWlEnabled(payload.enabled === true);
    } catch (err) {
      // Ignore if not loaded
    }
  }, []);

  useEffect(() => {
    fetchWhitelistStatus();
  }, [fetchWhitelistStatus]);

  const handleWlToggle = async () => {
    if (wlUploading) return;
    const next = !wlEnabled;
    try {
      const response = await toggleWhitelistApi({ whitelistEnabled: next });
      const payload = getResponseData(response);
      const realValue = payload?.whitelistEnabled ?? next;
      setWlEnabled(realValue);
      await fetchWhitelistStatus();
      toast.success(`Whitelist ${realValue ? 'enabled' : 'disabled'}`);
    } catch (err) {
      showApiError(err, 'Failed to toggle whitelist');
    }
  };

  const handleCsvUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';

    try {
      if (!file) return;
      if (wlUploading) return;

      setWlUploading(true);

      if (!file.name.toLowerCase().endsWith('.csv')) {
        toast.error('Only CSV files are allowed');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error('CSV must be under 5MB');
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', file.name);

      await uploadWhitelistCsv(formData);
      queryClient.invalidateQueries({ queryKey: ['whitelist'] });
      await fetchWhitelistStatus();

      toast.success('Whitelist uploaded successfully');
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Upload failed';
      toast.error(message);
    } finally {
      setWlUploading(false);
    }
  };

  const handleManualAdd = async () => {
    if (!wlManualEmail.trim()) return;
    setWlManualBusy(true);
    try {
      await addManualWhitelist(wlManualEmail.trim());

      queryClient.invalidateQueries({ queryKey: ['whitelist'] });

      toast.success('Email added to whitelist');
      setWlManualEmail('');
    } catch (err) {
      showApiError(err, 'Failed to add email');
    } finally {
      setWlManualBusy(false);
    }
  };

  const handleBulkDelete = async (emailsToDelete = selectedEmails) => {
    if (!emailsToDelete.length) return;
    if (emailsToDelete.length > 50) {
      toast.error('Max 50 emails at once');
      return;
    }

    const confirmMessage = emailsToDelete.length === 1
      ? `Delete ${emailsToDelete[0]} from the whitelist?\n\nSelections may include emails from multiple pages or search results.\nThis action cannot be undone.`
      : `Delete ${emailsToDelete.length} whitelist email(s)?\n\nSelections may include emails from multiple pages or search results.\nThis action cannot be undone.`;

    if (!window.confirm(confirmMessage)) return;

    setBulkDeleteBusy(true);
    try {
      await bulkDeleteWhitelistEmails(emailsToDelete);
      queryClient.invalidateQueries({ queryKey: ['whitelist'] });
      toast.success(`${emailsToDelete.length} email(s) deleted`);
      setSelectedEmails(prev => prev.filter(e => !emailsToDelete.includes(e)));
    } catch (err) {
      showApiError(err, 'Failed to delete emails');
    } finally {
      setBulkDeleteBusy(false);
    }
  };

  const toggleSelect = (email) => {
    setSelectedEmails((prev) => {
      if (prev.includes(email)) return prev.filter((e) => e !== email);
      if (prev.length >= 50) {
        toast.error('Max 50 emails can be selected at once');
        return prev;
      }
      return [...prev, email];
    });
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const newEmails = emails.map(i => i.email);
      const combined = [...new Set([...selectedEmails, ...newEmails])];
      if (combined.length > 50) {
        toast.error('Max 50 emails can be selected at once');
        setSelectedEmails(combined.slice(0, 50));
      } else {
        setSelectedEmails(combined);
      }
    } else {
      const pageEmails = emails.map(i => i.email);
      setSelectedEmails(prev => prev.filter(e => !pageEmails.includes(e)));
    }
  };

  // Search & Pagination Effects
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [debouncedSearch, isFetching]);

  useEffect(() => {
    if (data?.emails?.length === 0 && page > 1) {
      setPage(page - 1);
    } else if (totalPages > 0 && page > totalPages) {
      setPage(totalPages);
    }
  }, [data?.emails, page, totalPages]);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
          <HiOutlineShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Whitelist Management</h1>
          <p className="text-sm text-slate-600 mt-0.5">Manage verified email addresses and control registration access.</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Toggle + Status */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Whitelist enforcement</h3>
              <p className="mt-1 text-sm text-slate-500">
                When enabled, only whitelisted emails can register.
              </p>
              <div className="mt-3 flex items-center gap-4">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                  Status: {wlEnabled ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={wlEnabled}
              onClick={handleWlToggle}
              disabled={wlUploading}
              className={`shrink-0 flex items-center h-7 w-[3.25rem] rounded-full p-1 transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-60 ${wlEnabled ? 'bg-[#007BFF]' : 'bg-slate-200'
                }`}
            >
              <span
                className={`block h-5 w-5 rounded-full bg-white transition-transform duration-300 ${wlEnabled ? 'translate-x-6' : 'translate-x-0'
                  }`}
              />
            </button>
          </div>
        </section>

        {/* Upload CSV */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Upload CSV</h3>
          <p className="mt-1 text-sm text-slate-500">
            Upload a .csv file with one email per line.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <label
              className={`btn-primary inline-flex cursor-pointer items-center gap-2 text-sm ${wlUploading ? 'opacity-60 pointer-events-none' : ''
                }`}
            >
              <HiOutlineUpload size={16} />
              {wlUploading ? 'Uploading…' : 'Choose CSV'}
              <input
                type="file"
                accept=".csv"
                className="hidden"
                disabled={wlUploading}
                onChange={handleCsvUpload}
              />
            </label>
          </div>
        </section>
      </div>

      {/* Manual Add */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Add to whitelist</h3>
        <p className="mt-1 text-sm text-slate-500">Manually add an individual email address.</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="email"
            value={wlManualEmail}
            onChange={(e) => setWlManualEmail(e.target.value)}
            placeholder="student@example.com"
            disabled={wlManualBusy}
            className="input flex-1 text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleManualAdd();
              }
            }}
          />
          <button
            type="button"
            onClick={handleManualAdd}
            disabled={wlManualBusy || !wlManualEmail.trim()}
            className="btn-primary inline-flex items-center gap-1.5 text-sm disabled:opacity-60"
          >
            <HiOutlinePlus size={16} />
            Add
          </button>
        </div>
      </section>



      <hr className="border-slate-200 my-8" />

      {/* Search and Table Area */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Search Verified Emails</h2>
          <p className="mt-1 text-sm text-slate-500">Search and manage verified email records.</p>
        </div>
        <div className="w-full sm:w-auto flex items-center relative">
          <HiOutlineSearch className="absolute left-3 text-slate-400" size={18} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search emails..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-80 pl-10 pr-10 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 text-slate-400 hover:text-slate-600"
            >
              <HiOutlineX size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-4">
            <input
              type="checkbox"
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              onChange={handleSelectAll}
              checked={emails.length > 0 && emails.every(i => selectedEmails.includes(i.email))}
              disabled={emails.length === 0}
            />
            <div className="text-sm text-slate-600">
              Showing{' '}
              {total === 0 ? (
                <>
                  <span className="font-medium text-slate-900">0</span> of <span className="font-medium text-slate-900">0</span>
                </>
              ) : (
                <>
                  <span className="font-medium text-slate-900">{((page - 1) * limit) + 1}</span>
                  –
                  <span className="font-medium text-slate-900">{Math.min(page * limit, total)}</span> of <span className="font-medium text-slate-900">{total}</span>
                </>
              )}{' '}
              result{total === 1 ? '' : 's'}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {selectedEmails.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setSelectedEmails([])}
                  disabled={bulkDeleteBusy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  Clear Selection
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkDelete()}
                  disabled={bulkDeleteBusy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors"
                >
                  <HiOutlineTrash size={16} />
                  {bulkDeleteBusy ? 'Deleting...' : `Delete Selected (${selectedEmails.length})`}
                </button>
              </>
            )}
            {isFetching && (
              <div className="text-sm text-blue-600 font-medium flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                Updating...
              </div>
            )}
          </div>
        </div>

        <div className="p-0">
          {isLoading && !data ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-500">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
              <p>Loading whitelist...</p>
            </div>
          ) : isError ? (
            <div className="py-16 text-center text-red-600">
              <p className="font-medium text-lg">Error loading whitelist data</p>
              <p className="text-sm mt-1">{error?.message || 'Please try again later'}</p>
            </div>
          ) : emails.length === 0 ? (
            <div className="py-24 text-center">
              <HiOutlineMail className="mx-auto text-slate-300 mb-3" size={48} />
              <p className="text-lg font-medium text-slate-900">No emails found</p>
              <p className="text-sm text-slate-500 mt-1">Try adjusting your search criteria</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {emails.map((item) => {
                const formattedDate = formatDate(item.createdAt);
                return (
                  <div key={item._id || item.email} className="px-6 py-4 hover:bg-slate-50 transition-colors flex items-center justify-between">
                    <div className="flex items-center gap-4 min-w-0">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        checked={selectedEmails.includes(item.email)}
                        onChange={() => toggleSelect(item.email)}
                      />
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600">
                        <HiOutlineMail size={20} />
                      </div>
                      <div className="truncate">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          <HighlightMatch text={item.email} highlight={debouncedSearch} />
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Added {formattedDate}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleBulkDelete([item.email])}
                      disabled={bulkDeleteBusy}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <HiOutlineTrash size={18} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {total > 0 && (
        <PaginationControls
          pagination={{ currentPage: page, totalPages }}
          onPageChange={setPage}
          disabled={isLoading || isFetching}
        />
      )}
    </div>
  );
}
