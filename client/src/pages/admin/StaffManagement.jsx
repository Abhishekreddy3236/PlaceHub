import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineSearch, HiOutlineUsers, HiOutlineUserGroup } from 'react-icons/hi';
import StaffModal from '../../components/admin/StaffModal';
import StaffTable from '../../components/admin/StaffTable';
import ConfirmModal from '../../components/admin/ConfirmModal';
import { adminApi, getErrorMessage, getResponseData, showApiError, isSessionExpiredError } from '../../services/api';
import { CACHE_TIMES } from '../../services/queryClient';

const normalizeStaffList = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  if (Array.isArray(payload?.staff)) {
    return payload.staff;
  }

  if (Array.isArray(payload?.users)) {
    return payload.users.filter((user) => user?.role === 'staff');
  }

  return [];
};

const getStaffFromResponse = (response) => {
  const payload = getResponseData(response);
  return payload?.staff || payload;
};

const fetchStaffList = async () => {
  const response = await adminApi.getStaff();
  return normalizeStaffList(getResponseData(response));
};

export default function StaffManagement() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [permissionsModal, setPermissionsModal] = useState({
    open: false,
    staff: null,
  });
  const [updatingPermissions, setUpdatingPermissions] = useState(false);
  const [busyAction, setBusyAction] = useState(null);
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    type: '',
    staff: null,
    deleteType: 'soft',
  });

  const {
    data: staff = [],
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: ['admin-staff'],
    queryFn: fetchStaffList,
    staleTime: CACHE_TIMES.adminLists,
  });

  useEffect(() => {
    if (queryError && !isSessionExpiredError(queryError)) {
      showApiError(queryError, 'Failed to load staff accounts');
    }
  }, [queryError]);

  const loadError = useMemo(() => {
    if (!queryError) return '';
    if (isSessionExpiredError(queryError)) return '';
    return getErrorMessage(queryError, 'Failed to load staff accounts');
  }, [queryError]);

  const filteredStaff = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return staff;
    }

    return staff.filter((member) => {
      return (
        member.email?.toLowerCase().includes(query) ||
        member.name?.toLowerCase().includes(query) ||
        member.role?.toLowerCase().includes(query)
      );
    });
  }, [search, staff]);

  const handleCreateStaff = async (payload) => {
    setCreating(true);
    try {
      const response = await adminApi.createStaff(payload);
      queryClient.invalidateQueries({ queryKey: ['admin-staff'] });
      setStaffModalOpen(false);
      toast.success(response.data?.message || 'Staff account created');
    } catch (err) {
      showApiError(err, 'Failed to create staff account');
    } finally {
      setCreating(false);
    }
  };

  const requestResetPassword = useCallback((member) => {
    setConfirmModal({ open: true, type: 'reset', staff: member, deleteType: 'soft' });
  }, []);

  const requestEditPermissions = useCallback((member) => {
    setPermissionsModal({ open: true, staff: member });
  }, []);

  const closePermissionsModal = () => {
    if (updatingPermissions) {
      return;
    }

    setPermissionsModal({ open: false, staff: null });
  };

  const handleUpdatePermissions = async (payload) => {
    if (!payload?.staffId) {
      return;
    }

    setUpdatingPermissions(true);
    setBusyAction({ type: 'permissions', id: payload.staffId });

    try {
      const response = await adminApi.updateStaffPermissions(payload);
      queryClient.invalidateQueries({ queryKey: ['admin-staff'] });
      setPermissionsModal({ open: false, staff: null });
      toast.success(response.data?.message || 'Staff permissions updated');
    } catch (err) {
      showApiError(err, 'Failed to update staff permissions');
    } finally {
      setBusyAction(null);
      setUpdatingPermissions(false);
    }
  };

  const requestDelete = useCallback((member, deleteType) => {
    setConfirmModal({ open: true, type: 'delete', staff: member, deleteType });
  }, []);

  const closeConfirmModal = () => {
    if (busyAction) {
      return;
    }

    setConfirmModal({ open: false, type: '', staff: null, deleteType: 'soft' });
  };

  const handleToggleStatus = useCallback(async (member) => {
    const nextIsActive = member.isActive === false;

    setBusyAction({ type: 'status', id: member._id });

    try {
      const response = await adminApi.updateStaffStatus(member._id, nextIsActive);
      queryClient.invalidateQueries({ queryKey: ['admin-staff'] });
      toast.success(response.data?.message || (nextIsActive ? 'Staff unblocked' : 'Staff blocked'));
    } catch (err) {
      showApiError(err, 'Failed to update staff status');
    } finally {
      setBusyAction(null);
    }
  }, [queryClient]);

  const handleResetPassword = async () => {
    const member = confirmModal.staff;
    if (!member) {
      return;
    }

    setBusyAction({ type: 'reset', id: member._id });
    try {
      const response = await adminApi.resetStaffPassword(member._id);
      queryClient.invalidateQueries({ queryKey: ['admin-staff'] });
      toast.success(response.data?.message || 'Password reset email sent');
      setConfirmModal({ open: false, type: '', staff: null, deleteType: 'soft' });
    } catch (err) {
      showApiError(err, 'Failed to reset password');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDeleteStaff = async () => {
    const member = confirmModal.staff;
    const deleteType = confirmModal.deleteType;

    if (!member) {
      return;
    }

    setBusyAction({ type: 'delete', id: member._id });
    try {
      const response = await adminApi.deleteStaff(member._id, deleteType);
      queryClient.invalidateQueries({ queryKey: ['admin-staff'] });
      toast.success(response.data?.message || 'Staff account deleted');
      setConfirmModal({ open: false, type: '', staff: null, deleteType: 'soft' });
    } catch (err) {
      showApiError(err, 'Failed to delete staff account');
    } finally {
      setBusyAction(null);
    }
  };

  const confirmTitle =
    confirmModal.type === 'reset'
      ? 'Reset Staff Password'
      : confirmModal.deleteType === 'hard'
        ? 'Hard Delete Staff'
        : 'Soft Delete Staff';

  const confirmMessage =
    confirmModal.type === 'reset'
      ? `Reset password for ${confirmModal.staff?.email || 'this staff account'}? Current sessions will be invalidated.`
      : confirmModal.deleteType === 'hard'
        ? `Permanently delete ${confirmModal.staff?.email || 'this staff account'}? This cannot be undone.`
        : `Soft delete ${confirmModal.staff?.email || 'this staff account'}? The account will be blocked and hidden from active use.`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <HiOutlineUsers className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Staff Management</h1>
            <p className="text-sm text-slate-600 mt-0.5">Manage staff access, permissions, and account status.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStaffModalOpen(true)}
            className="btn-primary inline-flex items-center justify-center gap-2 text-sm"
          >
            <HiOutlinePlus size={18} />
            Create Staff
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <HiOutlineSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="input w-full py-2 pl-10 text-sm"
            placeholder="Search staff..."
          />
        </div>
        <div className="text-sm text-slate-600">
          {filteredStaff.length} of {staff.length} account{staff.length === 1 ? '' : 's'}
        </div>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          {loadError}
        </div>
      ) : null}

      <StaffTable
        staff={filteredStaff}
        loading={loading}
        busyAction={busyAction}
        onEditPermissions={requestEditPermissions}
        onResetPassword={requestResetPassword}
        onToggleStatus={handleToggleStatus}
        onDelete={requestDelete}
      />

      <StaffModal
        open={staffModalOpen}
        loading={creating}
        onClose={() => setStaffModalOpen(false)}
        onSubmit={handleCreateStaff}
      />

      <StaffModal
        open={permissionsModal.open}
        mode="edit"
        initialStaff={permissionsModal.staff}
        loading={updatingPermissions}
        onClose={closePermissionsModal}
        onSubmit={handleUpdatePermissions}
      />

      <ConfirmModal
        open={confirmModal.open}
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel={
          confirmModal.type === 'reset'
            ? 'Reset Password'
            : confirmModal.deleteType === 'hard'
              ? 'Hard Delete'
              : 'Soft Delete'
        }
        variant={confirmModal.type === 'reset' ? 'primary' : 'danger'}
        loading={Boolean(busyAction)}
        requireText={confirmModal.deleteType === 'hard' ? 'HARD_DELETE_STAFF' : ''}
        onCancel={closeConfirmModal}
        onConfirm={confirmModal.type === 'reset' ? handleResetPassword : handleDeleteStaff}
      />
    </div>
  );
}
