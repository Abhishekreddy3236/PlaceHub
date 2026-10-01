import { HiOutlineDevicePhoneMobile, HiOutlineXMark, HiOutlineShare } from 'react-icons/hi2';
import { usePWAInstallContext } from '../../context/PWAInstallContext';
import toast from 'react-hot-toast';

export default function PWAInstallBanner() {
  const { canShowInstallHelp, isIOSBrowser, installDismissed, isInstalled, handleInstall, handleDismiss, hasInstallPrompt } = usePWAInstallContext();

  if (isInstalled || !canShowInstallHelp || installDismissed) return null;

  return (
    <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm flex items-center justify-between gap-4 md:hidden">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 shrink-0 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
          <HiOutlineDevicePhoneMobile size={24} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-blue-900">Install PlaceHub</h3>
          <p className="text-sm text-blue-700 mt-0.5">
            For a faster, app-like experience.
          </p>
          {isIOSBrowser && (
            <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
              Tap <HiOutlineShare className="inline" /> Share, then "Add to Home Screen"
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {!isIOSBrowser && (
          <button
            onClick={() => hasInstallPrompt ? handleInstall() : toast('Install option is currently unavailable', { icon: 'ℹ️' })}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-black rounded-lg shadow-sm hover:shadow-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            Install
          </button>
        )}
        <button
          onClick={handleDismiss}
          className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
          aria-label="Dismiss"
        >
          <HiOutlineXMark size={20} />
        </button>
      </div>
    </div>
  );
}
