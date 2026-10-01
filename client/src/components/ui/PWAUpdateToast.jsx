import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { useRegisterSW } from 'virtual:pwa-register/react';

export default function PWAUpdateToast() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // SW Registered
    },
    onRegisterError(error) {
      console.error('SW registration error', error);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      toast(
        (t) => (
          <div className="flex items-center gap-4">
            <div>
              <p className="text-sm font-medium text-slate-900">New version available!</p>
              <p className="text-xs text-slate-500">Click reload to update.</p>
            </div>
            <div className="flex gap-2">
              <button
                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-md hover:bg-blue-700 transition-colors"
                onClick={() => {
                  updateServiceWorker(true);
                  toast.dismiss(t.id);
                }}
              >
                Reload
              </button>
            </div>
          </div>
        ),
        { 
          duration: Infinity, 
          position: 'top-center',
          id: 'pwa-update-toast'
        }
      );
    }
  }, [needRefresh, setNeedRefresh, updateServiceWorker]);

  return null;
}
