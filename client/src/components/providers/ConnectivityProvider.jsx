import { useSyncExternalStore } from 'react';
import { onlineManager } from '@tanstack/react-query';
import { MdOutlineCloudOff } from 'react-icons/md';

export default function ConnectivityProvider({ children }) {
  const isOnline = useSyncExternalStore(
    onlineManager.subscribe,
    () => onlineManager.isOnline(),
    () => true
  );

  return (
    <>
      {!isOnline && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 w-[calc(100%-32px)] sm:max-w-md z-[99998] pointer-events-none">
          <div className="bg-zinc-900/95 backdrop-blur-md text-zinc-50 border border-zinc-800 rounded-full shadow-xl px-4 py-2.5 flex items-center gap-3 pointer-events-auto w-full animate-[slideDown_0.3s_ease-out]">
            <style>
              {`
                @keyframes slideDown {
                  from { transform: translateY(-150%); opacity: 0; }
                  to { transform: translateY(0); opacity: 1; }
                }
              `}
            </style>
            <div className="bg-zinc-800 p-1.5 rounded-full flex-shrink-0 text-zinc-300">
              <MdOutlineCloudOff size={18} />
            </div>
            <p className="text-sm font-medium">
              You're offline. We'll keep you updated once you're reconnected.
            </p>
          </div>
        </div>
      )}
      {children}
    </>
  );
}
