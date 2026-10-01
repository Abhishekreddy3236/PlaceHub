import React from 'react';

export default function LogoutConfirmModal({ isOpen, onClose, onConfirm, loading }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 transition-all duration-300">
      <div className="bg-white rounded-[20px] sm:rounded-[24px] shadow-2xl w-full max-w-[310px] sm:max-w-[360px] mx-auto overflow-hidden p-5 sm:p-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center mb-6 sm:mb-7">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 mb-1.5 sm:mb-2.5">Log out?</h2>
          <p className="text-slate-600 font-medium text-sm sm:text-[16px] leading-relaxed px-1 sm:px-2">
            Are you sure you want to log out? You'll be signed out on all devices.
          </p>
        </div>

        <div className="flex flex-col w-full gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="w-full py-2.5 sm:py-3 px-4 text-sm sm:text-[15px] font-semibold text-white bg-blue-600 rounded-full hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors shadow-sm"
          >
            {loading ? 'Logging out...' : 'Log out'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-full py-2.5 sm:py-3 px-4 text-sm sm:text-[15px] font-semibold text-slate-700 bg-white border border-slate-300 rounded-full hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
