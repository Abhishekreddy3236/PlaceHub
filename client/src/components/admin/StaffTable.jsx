import React, { useMemo } from 'react';
import { HiOutlineBan, HiOutlineCheckCircle, HiOutlineKey, HiOutlinePencil, HiOutlineXCircle } from 'react-icons/hi';
import Loader from '../common/Loader';

const permissionLabels = {
  read: 'Read',
  write: 'Write',
  none: 'None',
};

const formatPermission = (value) => permissionLabels[value] || 'Read';

function PermissionPill({ label, value }) {
  const isWrite = value === 'write';

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
        isWrite ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
      }`}
    >
      {label}: {formatPermission(value)}
    </span>
  );
}

function StaffTable({
  staff,
  loading,
  busyAction,
  onEditPermissions,
  onResetPassword,
  onToggleStatus,
  onDelete,
}) {
  const rows = useMemo(() => (Array.isArray(staff) ? staff : []), [staff]);
  const isBusy = Boolean(busyAction);

  if (loading) {
    return <Loader variant="table" rows={6} />;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-5 py-4 font-semibold">Email</th>
              <th className="px-5 py-4 font-semibold">Role</th>
              <th className="px-5 py-4 font-semibold">Status</th>
              <th className="px-5 py-4 font-semibold">Permissions</th>
              <th className="px-5 py-4 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-5 py-12 text-center text-slate-500">
                  No staff accounts found.
                </td>
              </tr>
            ) : (
              rows.map((member) => {
                const permissions = member.permissions || {};
                const actionKey = busyAction?.id === member._id ? busyAction.type : '';
                const isDeleted = member.isDeleted === true;
                const isActive = member.isActive !== false && !isDeleted;

                return (
                  <tr key={member._id} className="h-[56px] align-middle hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                    <td className="px-5 py-4">
                      <div className="font-semibold">{member.email || 'No email'}</div>
                      {member.name ? (
                        <div className="mt-0.5 text-xs text-slate-400">{member.name}</div>
                      ) : null}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-700">
                        {member.role || 'staff'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          isDeleted
                            ? 'bg-slate-100 text-slate-500'
                            : isActive
                              ? 'bg-green-50 text-green-700'
                              : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {isDeleted ? 'Deleted' : isActive ? 'Active' : 'Blocked'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        <PermissionPill label="Students" value={permissions.users} />
                        <PermissionPill label="Jobs" value={permissions.jobs} />
                        <PermissionPill label="Applications" value={permissions.applications} />
                        <PermissionPill label="Access Control" value={permissions.accessControl} />
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onEditPermissions(member)}
                          disabled={isBusy || isDeleted}
                          title="Edit permissions"
                          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {actionKey === 'permissions' ? (
                            <span className="block h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                          ) : (
                            <HiOutlinePencil size={20} />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleStatus(member)}
                          disabled={isBusy || isDeleted}
                          title={isActive ? 'Block staff' : 'Unblock staff'}
                          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-amber-50 hover:text-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {actionKey === 'status' ? (
                            <span className="block h-5 w-5 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                          ) : isActive ? (
                            <HiOutlineBan size={20} />
                          ) : (
                            <HiOutlineCheckCircle size={20} />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => onResetPassword(member)}
                          disabled={isBusy || isDeleted}
                          title="Reset password"
                          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {actionKey === 'reset' ? (
                            <span className="block h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                          ) : (
                            <HiOutlineKey size={20} />
                          )}
                        </button>
                        {/* TODO: Re-enable this Soft Delete action after the soft delete feature is implemented.
                        <button
                          type="button"
                          onClick={() => onDelete(member, 'soft')}
                          disabled={isBusy || isDeleted}
                          title="Soft delete"
                          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <HiOutlineTrash size={20} />
                        </button>
                        */}
                        <button
                          type="button"
                          onClick={() => onDelete(member, 'hard')}
                          disabled={isBusy}
                          title="Hard delete"
                          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {actionKey === 'delete' ? (
                            <span className="block h-5 w-5 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                          ) : (
                            <HiOutlineXCircle size={20} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default React.memo(StaffTable);
