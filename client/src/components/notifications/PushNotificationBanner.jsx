import { useState } from 'react';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { HiOutlineBell } from 'react-icons/hi';
import toast from 'react-hot-toast';

export default function PushNotificationBanner() {
  const { isSupported, permission, isSubscribing, subscribeToPush } = usePushNotifications();
  const [isDismissed, setIsDismissed] = useState(false);

  // Only show the banner if notifications are supported, NOT already granted, NOT denied, and NOT dismissed
  if (!isSupported || permission !== 'default' || isDismissed) {
    return null;
  }

  const handleSubscribe = async () => {
    const success = await subscribeToPush();
    if (success) {
      toast.success('Notifications enabled!');
    } else {
      if (Notification.permission === 'denied') {
        toast.error('Notification permission denied.');
      } else {
        toast.error('Failed to enable notifications. Please try again later.');
      }
    }
  };

  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:gap-4 sm:p-5">

      {/* Icon */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 sm:mt-0.5 sm:h-10 sm:w-10">
        <HiOutlineBell className="h-4 w-4 stroke-[1.5] sm:h-5 sm:w-5" />
      </div>

      <div className="flex w-full flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">

        {/* Text */}
        <div className="flex flex-col">
          <h3 className="text-sm font-semibold text-gray-900">
            Stay updated with your placements
          </h3>
          <p className="mt-1 max-w-lg text-[13px] leading-relaxed text-gray-500 sm:text-sm">
            Get instant alerts when new jobs are posted and when your application status changes.
          </p>
        </div>

        {/* Actions */}
        <div className="mt-1 flex shrink-0 items-center justify-start gap-2 md:mt-0 md:justify-end">
          <button
            onClick={() => setIsDismissed(true)}
            className="rounded-lg px-3 py-2 text-[13px] font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 sm:text-sm"
          >
            Not now
          </button>
          <button
            onClick={handleSubscribe}
            disabled={isSubscribing}
            className="rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400 sm:text-sm"
          >
            {isSubscribing ? 'Enabling...' : 'Enable'}
          </button>
        </div>
      </div>

    </div>
  );
}
