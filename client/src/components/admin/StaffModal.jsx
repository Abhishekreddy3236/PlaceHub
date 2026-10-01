import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Loader from '../common/Loader';

const permissionFields = [
  { key: 'users', label: 'Students' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'applications', label: 'Applications' },
  { key: 'accessControl', label: 'Access Control' },
];

const defaultPermissions = {
  users: 'none',
  jobs: 'none',
  applications: 'none',
  accessControl: 'none',
};

const normalizePermissions = (permissions = {}) => ({
  users: ['read', 'write'].includes(permissions.users) ? permissions.users : 'none',
  jobs: ['read', 'write'].includes(permissions.jobs) ? permissions.jobs : 'none',
  applications: ['read', 'write'].includes(permissions.applications) ? permissions.applications : 'none',
  accessControl: ['read', 'write'].includes(permissions.accessControl) ? permissions.accessControl : 'none',
});

function StaffModal({
  open,
  loading = false,
  mode = 'create',
  initialStaff = null,
  onClose,
  onSubmit,
}) {
  const [email, setEmail] = useState('');
  const [permissions, setPermissions] = useState(defaultPermissions);
  const isEditMode = mode === 'edit';

  useEffect(() => {
    if (open) {
      setEmail(isEditMode ? initialStaff?.email || '' : '');
      setPermissions(
        isEditMode
          ? normalizePermissions(initialStaff?.permissions)
          : { ...defaultPermissions }
      );
    }
  }, [initialStaff, isEditMode, open]);

  const trimmedEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  if (!open) {
    return null;
  }

  const handlePermissionChange = (key, value) => {
    setPermissions((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if ((!isEditMode && !trimmedEmail) || loading) {
      return;
    }

    if (!isEditMode && (!trimmedEmail.includes('@'))) {
      toast.error('Enter a valid email');
      return;
    }

    onSubmit?.(
      isEditMode
        ? {
            staffId: initialStaff?._id,
            permissions,
          }
        : {
            email: trimmedEmail,
            permissions,
          }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-900">
            {isEditMode ? 'Edit Permissions' : 'Create Staff'}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {isEditMode ? 'Changes are saved to the staff account.' : 'Credentials will be sent by email.'}
          </p>
        </div>

        <div className="space-y-5 p-6">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="text"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="input w-full text-sm"
              placeholder="staff@example.com"
              autoComplete="email"
              required={!isEditMode}
              disabled={isEditMode}
            />
          </div>

          <div>
            <h3 className="mb-3 text-sm font-medium text-slate-700">Permissions</h3>
            <div className="space-y-3">
              {permissionFields.map((field) => (
                <div
                  key={field.key}
                  className="flex flex-col gap-3 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="text-sm font-medium text-slate-700">{field.label}</span>
                  <div className="grid w-full grid-cols-3 rounded-lg border border-slate-200 bg-slate-50 p-1 sm:w-60">
                    {['none', 'read', 'write'].map((value) => {
                      const active = permissions[field.key] === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => handlePermissionChange(field.key, value)}
                          className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                            active
                              ? 'bg-white text-blue-600 shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {value}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || (!isEditMode && !trimmedEmail) || (isEditMode && !initialStaff?._id)}
            className="inline-flex min-w-32 items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader size="sm" label="" /> : isEditMode ? 'Save Permissions' : 'Create Staff'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default React.memo(StaffModal);
