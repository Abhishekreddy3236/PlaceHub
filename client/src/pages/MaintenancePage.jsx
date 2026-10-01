import Logo from '../components/ui/Logo';
import { Settings } from 'lucide-react';

const MaintenancePage = () => {
  return (
    <div className="min-h-[100dvh] w-full bg-[#FAFAFA] flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 font-sans antialiased selection:bg-zinc-200 overflow-hidden">
      <div className="w-full max-w-[420px] mx-auto flex flex-col items-center">
        {/* Logo */}
        <div className="mb-10 flex justify-center w-full">
          <Logo className="h-12 sm:h-14 w-auto block object-contain translate-x-[14%]" />
        </div>

        {/* Card Content */}
        <div className="bg-white w-full rounded-2xl border border-zinc-200/70 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.02)] p-8 sm:p-10 text-center flex flex-col items-center">
          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-zinc-50 border border-zinc-200/60 shadow-sm flex items-center justify-center mb-6">
            <Settings className="w-8 h-8 text-zinc-700" strokeWidth={2} />
          </div>

          <h1 className="text-center w-full text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight mb-4">
            Scheduled Maintenance
          </h1>

          <div className="text-center w-full text-base sm:text-lg text-zinc-600 font-medium leading-relaxed max-w-[300px] sm:max-w-[360px] mx-auto">
            <p>We're making improvements to PlaceHub to deliver a better experience.</p>
            <p className="mt-3">We'll be back shortly.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MaintenancePage;
