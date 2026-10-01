import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { HiOutlineGlobeAlt, HiOutlineRefresh } from 'react-icons/hi';
import { adminApi, getErrorMessage, getResponseData, showApiError } from '../../services/api';
import Loader from '../../components/common/Loader';

const domainsToText = (domains) =>
  (Array.isArray(domains) ? domains : [])
    .map((d) => String(d || '').trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean)
    .join(', ');

const yearsToText = (years) =>
  (Array.isArray(years) ? years : [])
    .map((y) => String(y || '').trim())
    .filter(Boolean)
    .join(', ');

export default function RegistrationConfig() {
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [domainRestrictionEnabled, setDomainRestrictionEnabled] = useState(false);
  const [yearRestrictionEnabled, setYearRestrictionEnabled] = useState(false);
  const [domainsText, setDomainsText] = useState('');
  const [yearsText, setYearsText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [originalConfig, setOriginalConfig] = useState(null);

  const applyConfig = (nextConfig) => {
    if (!nextConfig || typeof nextConfig !== 'object') {
      return;
    }
    const reg = nextConfig.registrationEnabled !== false;
    const domRestr = nextConfig.domainRestrictionEnabled === true;
    const yearRestr = nextConfig.yearRestrictionEnabled === true;
    const domTxt = domainsToText(nextConfig.allowedDomains);
    const yrTxt = yearsToText(nextConfig.allowedYears);

    setRegistrationEnabled(reg);
    setDomainRestrictionEnabled(domRestr);
    setYearRestrictionEnabled(yearRestr);
    setDomainsText(domTxt);
    setYearsText(yrTxt);

    setOriginalConfig({
      registrationEnabled: reg,
      domainRestrictionEnabled: domRestr,
      yearRestrictionEnabled: yearRestr,
      domainsText: domTxt,
      yearsText: yrTxt,
    });
  };

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const response = await adminApi.getConfig();
      const nextConfig = getResponseData(response) || {};
      applyConfig(nextConfig);
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to load registration config');
      setLoadError(message || '');
      showApiError(error, 'Failed to load registration config');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const isDirty = originalConfig ? JSON.stringify({
    registrationEnabled,
    domainRestrictionEnabled,
    yearRestrictionEnabled,
    domainsText,
    yearsText
  }) !== JSON.stringify(originalConfig) : false;

  useEffect(() => {
    const handler = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const saveAll = async () => {
    if (saving) return;

    setSaving(true);
    try {
      const payload = {
        registrationEnabled: registrationEnabled === true,
        domainRestrictionEnabled: domainRestrictionEnabled === true,
        yearRestrictionEnabled: yearRestrictionEnabled === true,
        allowedDomains: domainsText,
        allowedYears: yearsText,
      };

      const response = await adminApi.saveRegistrationConfig(payload);
      applyConfig(getResponseData(response) || {});
      toast.success(response.data?.message || 'Configuration saved');
    } catch (error) {
      showApiError(error, 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };





  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <HiOutlineGlobeAlt className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Registration Settings</h1>
            <p className="text-sm text-slate-600 mt-0.5">
              Manage student registration rules, email domains, and eligibility requirements.
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {isDirty && (
            <p className="text-sm font-medium text-orange-600">
              You have unsaved changes
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fetchConfig()}
              disabled={saving}
              className="btn-secondary inline-flex items-center justify-center gap-2 text-sm disabled:opacity-60"
            >
              <HiOutlineRefresh size={18} />
              Refresh
            </button>
            <button
              type="button"
              onClick={saveAll}
              disabled={saving || !isDirty}
              className="btn-primary text-sm disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save all'}
            </button>
          </div>
        </div>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{loadError}</div>
      ) : null}

      {loading ? (
        <Loader variant="dashboard" />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors duration-150">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Student registration</h2>
                  <p className="mt-1 text-sm text-slate-600">Allow or pause new student registrations.</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={registrationEnabled}
                  onClick={() => setRegistrationEnabled(!registrationEnabled)}
                  disabled={saving}
                  className={`shrink-0 flex items-center h-7 w-[3.25rem] rounded-full p-1 transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-60 ${registrationEnabled ? 'bg-[#007BFF]' : 'bg-slate-200'
                    }`}
                >
                  <span
                    className={`block h-5 w-5 rounded-full bg-white transition-transform duration-300 ${registrationEnabled ? 'translate-x-6' : 'translate-x-0'
                      }`}
                  />
                </button>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors duration-150">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Domain restriction</h2>
                  <p className="mt-1 text-sm text-slate-600">Allow signups only from approved email domains.</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={domainRestrictionEnabled}
                  onClick={() => setDomainRestrictionEnabled(!domainRestrictionEnabled)}
                  disabled={saving}
                  className={`shrink-0 flex items-center h-7 w-[3.25rem] rounded-full p-1 transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-60 ${domainRestrictionEnabled ? 'bg-[#007BFF]' : 'bg-slate-200'
                    }`}
                >
                  <span
                    className={`block h-5 w-5 rounded-full bg-white transition-transform duration-300 ${domainRestrictionEnabled ? 'translate-x-6' : 'translate-x-0'
                      }`}
                  />
                </button>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors duration-150">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Year / cohort restriction</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    When enabled, the email must include an underscore _, and the part after the last underscore must be a valid year.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={yearRestrictionEnabled}
                  onClick={() => setYearRestrictionEnabled(!yearRestrictionEnabled)}
                  disabled={saving}
                  className={`shrink-0 flex items-center h-7 w-[3.25rem] rounded-full p-1 transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-60 ${yearRestrictionEnabled ? 'bg-[#007BFF]' : 'bg-slate-200'
                    }`}
                >
                  <span
                    className={`block h-5 w-5 rounded-full bg-white transition-transform duration-300 ${yearRestrictionEnabled ? 'translate-x-6' : 'translate-x-0'
                      }`}
                  />
                </button>
              </div>
            </section>
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Allowed domains</h2>
            <p className="mt-1 text-sm text-slate-600">Comma-separated hostnames (example: gmail.com, woxsen.edu.in).</p>
            <textarea
              value={domainsText}
              onChange={(e) => setDomainsText(e.target.value)}
              disabled={saving}
              rows={3}
              className="mt-4 w-full input text-base font-sans"
              placeholder="gmail.com, woxsen.edu.in"
            />
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Allowed years</h2>
            <p className="mt-1 text-sm text-slate-600">Comma-separated cohort years (example: 2026, 2027).</p>
            <textarea
              value={yearsText}
              onChange={(e) => setYearsText(e.target.value)}
              disabled={saving}
              rows={2}
              className="mt-4 w-full input text-sm font-sans"
              placeholder="2026, 2027"
            />
          </section>
        </>
      )}

    </div>
  );
}

