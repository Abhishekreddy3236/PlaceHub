import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAuthenticatedHomePath } from '../utils/rbac';
import {
  HiOutlineHome,
  HiOutlineBriefcase,
  HiOutlineDocumentText,
  HiOutlineBookmark,
  HiOutlineUser,
  HiOutlineLogout,
  HiOutlineChevronDown,
  HiOutlineOfficeBuilding,
  HiOutlineShieldCheck,
  HiOutlineBadgeCheck,
  HiOutlineLockClosed,
  HiOutlineClipboardCheck,
  HiOutlineLocationMarker,
  HiOutlineClock
} from 'react-icons/hi';
import { SHOW_TEAM_SECTION } from '../utils/constants';
import Logo from '../components/ui/Logo';

export default function Home() {
  const { user, loading, networkError } = useAuth();
  const dashboardPath = user ? getAuthenticatedHomePath(user) : '/login';

  const [openFaq, setOpenFaq] = useState(0);

  const faqs = [
    {
      q: 'Who can use PlaceHub?',
      a: 'PlaceHub is restricted to Woxsen University students, official placement officers (Admin/Staff), and registered recruiters (HR) participating in campus drives.',
    },
    {
      q: 'How do I apply to a placement drive?',
      a: 'Once your academic profile is complete and you have an active resume uploaded, you can browse active drives and apply with a single click if you meet the eligibility criteria.',
    },
    {
      q: 'Can I update my profile after submission?',
      a: 'Yes, you can update your profile details and resume anytime from your dashboard. However, once you apply to a placement drive, a copy of your profile and resume is captured for that application. These details cannot be changed afterward, ensuring consistency throughout the selection process.',
    },
    {
      q: 'How is my application status updated?',
      a: 'Application statuses (In-Progress, Selected, Rejected) and current interview rounds are updated directly by the placement officers or HR managing the drive.',
    },
  ];

  // NOTE: To showcase or hide the entire Team section in both Navbar and Home page,
  // toggle SHOW_TEAM_SECTION (true / false) in client/src/utils/constants.js
  const projectFounder = {
    name: 'Sai Hari Krishna',
    role: 'Founder & Lead Developer',
    initials: 'SHK',
    photo: "/team/SAI Photo.jpg",
  };

  const coreTeam = [
    {
      name: 'Shravya',
      role: 'Frontend UI/UX Engineer',
      initials: 'SV',
      photo: null,
    },
    {
      name: 'Lasya',
      role: 'Backend & Systems Engineer',
      initials: 'LS',
      photo: null,
    },
    {
      name: 'Yogesh',
      role: 'Database & DevOps Lead',
      initials: 'YG',
      photo: null,
    },
    {
      name: 'Poojith',
      role: 'Security & QA Specialist',
      initials: 'PJ',
      photo: null,
    },
  ];

  return (
    <div className="bg-white min-h-screen text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900 overflow-x-hidden relative z-0">

      {/* HERO BACKGROUND HIGHLIGHT */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-slate-400/[0.04] blur-[100px] rounded-full pointer-events-none -z-10"></div>

      {/* HERO & DASHBOARD PREVIEW */}
      <div className="pt-20 pb-20 lg:pt-28 px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto">

        <div className="flex flex-col items-center text-center">
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-[7.5rem] font-black text-slate-900 tracking-tighter leading-[1.02] max-w-4xl mx-auto">
            Your placement<br />
            journey,<br />
            <span className="text-blue-600">simplified.</span>
          </h1>

          <p className="mt-8 sm:mt-10 text-lg sm:text-[20px] text-slate-500 font-medium leading-relaxed max-w-xl mx-auto px-2">
            Stop entering the same details for every placement drive. Build your profile once, apply in one click, and track every application from one platform.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center gap-4 justify-center w-full sm:w-auto">
            {(loading || networkError) ? (
              <div className="h-14 w-48 bg-slate-100 rounded-lg animate-pulse" />
            ) : user ? (
              <Link to={dashboardPath} className="px-10 py-4 bg-blue-600 text-white text-[16px] font-bold rounded-lg hover:bg-blue-700 transition-colors w-full sm:w-auto">
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link to="/register" className="px-10 py-4 bg-blue-600 text-white text-[16px] font-bold rounded-lg hover:bg-blue-700 transition-colors w-full sm:w-auto">
                  Get Started
                </Link>
                <Link to="/login" className="px-10 py-4 bg-transparent text-slate-900 text-[16px] font-bold hover:text-blue-600 transition-colors w-full sm:w-auto">
                  Sign In →
                </Link>
              </>
            )}
          </div>
        </div>

        {/* MASSIVE APP WINDOW PREVIEW */}
        <div className="mt-16 w-full max-w-[1200px] mx-auto bg-[#F8F9FA] rounded-xl border border-slate-200 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.1)] overflow-hidden flex-col pointer-events-none select-none hidden md:flex h-[820px]">
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden flex flex-col flex-1">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200 bg-slate-50">
              <span className="w-3 h-3 rounded-full bg-red-400"></span>
              <span className="w-3 h-3 rounded-full bg-yellow-400"></span>
              <span className="w-3 h-3 rounded-full bg-green-400"></span>
              <span className="mx-auto text-xs text-slate-400 font-medium">
                PlaceHub
              </span>
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="flex flex-1 h-full">

                {/* Sidebar Mock */}
                <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
                  <div className="h-16 flex items-center px-6 border-b border-slate-100">
                    <Logo className="h-6" />
                  </div>
                  <div className="flex-1 py-6 px-4 space-y-2">
                    <div className="flex items-center gap-3 px-3 py-2.5 bg-blue-50 text-blue-700 rounded-lg text-[14px] font-bold">
                      <HiOutlineHome size={20} /> Dashboard
                    </div>
                    <div className="flex items-center gap-3 px-3 py-2.5 text-slate-600 rounded-lg text-[14px] font-medium">
                      <HiOutlineBriefcase size={20} /> Jobs
                    </div>
                    <div className="flex items-center gap-3 px-3 py-2.5 text-slate-600 rounded-lg text-[14px] font-medium">
                      <HiOutlineDocumentText size={20} /> Applications
                    </div>
                    <div className="flex items-center gap-3 px-3 py-2.5 text-slate-600 rounded-lg text-[14px] font-medium">
                      <HiOutlineBookmark size={20} /> Saved Jobs
                    </div>
                    <div className="flex items-center gap-3 px-3 py-2.5 text-slate-600 rounded-lg text-[14px] font-medium">
                      <HiOutlineUser size={20} /> Profile
                    </div>
                  </div>
                  <div className="p-4 border-t border-slate-100">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs">S</div>
                      <div className="overflow-hidden">
                        <div className="text-[13px] font-bold text-slate-900 truncate">Sai</div>
                        <div className="text-[11px] text-slate-500 truncate">sai@waoxsen.edu.in</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 px-3 py-2 text-slate-600 rounded-lg text-[13px] font-medium">
                      <HiOutlineLogout size={18} /> Logout
                    </div>
                  </div>
                </div>

                {/* Main Content Mock */}
                <div className="flex-1 flex flex-col bg-[#F8F9FA] overflow-hidden">
                  <div className="h-16 flex items-center px-8 border-b border-slate-200 bg-white">
                    <span className="text-[15px] font-bold text-slate-900">Dashboard</span>
                  </div>

                  <div className="p-8 flex-1">
                    {/* Welcome - Editorial SaaS Header matching Original Dashboard */}
                    <div className="mb-6 rounded-2xl border border-slate-200/80 bg-white px-6 py-5 shadow-[0_2px_8px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)]">
                      <div className="flex items-center justify-between gap-6">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-[13px] font-medium tracking-wide text-slate-500 mb-2">
                            <span>Monday, Jul 13</span>
                          </div>

                          <h2 className="text-2xl font-bold text-slate-900 tracking-tight leading-tight">
                            Good Afternoon, <span className="text-blue-700">Sai</span>
                          </h2>

                          <p className="text-[14px] font-medium text-slate-600 mt-1">
                            Here&apos;s what&apos;s happening with your placement journey today.
                          </p>

                          <p className="mt-3 text-[13px] text-slate-500 italic">
                            &ldquo;There are no shortcuts to any place worth going.&rdquo;
                          </p>
                        </div>

                        <div className="flex items-center gap-7 shrink-0 border-l border-slate-100/80 pl-7">
                          <div>
                            <div className="text-[12px] font-medium text-slate-500">Applications</div>
                            <div className="text-2xl font-bold text-slate-900 mt-0.5">4</div>
                          </div>
                          <div className="h-8 w-px bg-slate-100" />
                          <div>
                            <div className="text-[12px] font-medium text-slate-500">Saved Jobs</div>
                            <div className="text-2xl font-bold text-slate-900 mt-0.5">1</div>
                          </div>
                          <div className="h-8 w-px bg-slate-100" />
                          <div>
                            <div className="text-[12px] font-medium text-slate-500">Profile Status</div>
                            <div className="text-2xl font-bold text-blue-600 mt-0.5">100%</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Quick Stats & Actions matching Original Dashboard */}
                    <div className="grid grid-cols-4 gap-4 mb-8">
                      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-slate-700">
                            <HiOutlineClipboardCheck size={20} />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-[14px] font-semibold text-slate-900 truncate">Total Applications</h3>
                            <p className="text-[12px] font-medium text-slate-500 mt-0.5">4 submitted</p>
                          </div>
                        </div>
                        <div className="text-[12px] font-semibold text-blue-600 mt-3 inline-flex items-center gap-1">
                          <span>View Applications</span>
                          <span>&rarr;</span>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-slate-700">
                            <HiOutlineBookmark size={20} />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-[14px] font-semibold text-slate-900 truncate">Saved Jobs</h3>
                            <p className="text-[12px] font-medium text-slate-500 mt-0.5">1 bookmarked</p>
                          </div>
                        </div>
                        <div className="text-[12px] font-semibold text-blue-600 mt-3 inline-flex items-center gap-1">
                          <span>View Saved Jobs</span>
                          <span>&rarr;</span>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-slate-700">
                            <HiOutlineUser size={20} />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-[14px] font-semibold text-slate-900 truncate">Update Profile</h3>
                            <p className="text-[12px] font-medium text-slate-500 mt-0.5 truncate">Keep it current</p>
                          </div>
                        </div>
                        <div className="text-[12px] font-semibold text-blue-600 mt-3 inline-flex items-center gap-1">
                          <span>Edit Profile</span>
                          <span>&rarr;</span>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-slate-700">
                            <HiOutlineBriefcase size={20} />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-[14px] font-semibold text-slate-900 truncate">Find Jobs</h3>
                            <p className="text-[12px] font-medium text-slate-500 mt-0.5 truncate">Browse openings</p>
                          </div>
                        </div>
                        <div className="text-[12px] font-semibold text-blue-600 mt-3 inline-flex items-center gap-1">
                          <span>Explore Openings</span>
                          <span>&rarr;</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-end mb-4">
                      <h3 className="text-[16px] font-bold text-slate-900">Recent Jobs</h3>
                      <span className="text-[13px] font-bold text-blue-600">View all →</span>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="card-hover block relative overflow-hidden p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] bg-white/90 rounded-xl border border-slate-200/80">
                        <div className="flex items-start justify-between gap-4 mt-1">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="w-10 h-10 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0">
                              <HiOutlineOfficeBuilding className="text-slate-500 text-xl" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-lg md:text-xl font-semibold text-slate-900 truncate">Software Engineer</h3>
                              <p className="text-blue-600 font-medium hover:text-blue-700 transition mt-1">ADP</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                            <span className="shrink-0 px-2 py-1 rounded-full text-xs font-medium shadow-sm transition-colors bg-green-600 text-white">
                              Open
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 mt-4 text-sm text-slate-500">
                          <span className="flex items-center gap-1">
                            <HiOutlineLocationMarker className="text-slate-500" />
                            <span className="text-slate-600 font-medium">Location:</span>
                            <span className="font-normal text-slate-900">Hyderabad</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <HiOutlineBriefcase className="text-slate-500" />
                            <span className="text-slate-600 font-medium">Type:</span>
                            <span className="font-normal text-slate-900">Full-time</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <HiOutlineClock className="text-slate-500" />
                            <span className="text-slate-600 font-medium">Deadline:</span>
                            <span className="font-normal text-slate-900">26 Jun 2026, 04:30 PM</span>
                          </span>
                        </div>

                        <div className="mt-3 text-sm text-slate-500 space-y-1">
                          <div>
                            <span className="text-slate-600 font-medium">Eligible branches:</span> <span className="font-normal text-slate-900">B. Tech</span>
                          </div>
                          <div>
                            <span className="text-slate-600 font-medium">Eligible Batch:</span> <span className="font-normal text-slate-900">2027</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mt-4">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-xs font-medium">
                            ML
                          </span>
                        </div>
                      </div>

                      <div className="card-hover block relative overflow-hidden p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] bg-white/90 rounded-xl border border-slate-200/80">
                        <div className="flex items-start justify-between gap-4 mt-1">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="w-10 h-10 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0">
                              <HiOutlineOfficeBuilding className="text-slate-500 text-xl" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-lg md:text-xl font-semibold text-slate-900 truncate">SDE</h3>
                              <p className="text-blue-600 font-medium hover:text-blue-700 transition mt-1">HighRadius</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                            <span className="shrink-0 px-2 py-1 rounded-full text-xs font-medium shadow-sm transition-colors bg-red-600 text-white">
                              Closed
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 mt-4 text-sm text-slate-500">
                          <span className="flex items-center gap-1">
                            <HiOutlineLocationMarker className="text-slate-500" />
                            <span className="text-slate-600 font-medium">Location:</span>
                            <span className="font-normal text-slate-900">Hyderabad</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <HiOutlineBriefcase className="text-slate-500" />
                            <span className="text-slate-600 font-medium">Type:</span>
                            <span className="font-normal text-slate-900">Full-time</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <HiOutlineClock className="text-slate-500" />
                            <span className="text-slate-600 font-medium">Deadline:</span>
                            <span className="font-normal text-slate-900">22 Jun 2026, 09:30 PM</span>
                          </span>
                        </div>

                        <div className="mt-3 text-sm text-slate-500 space-y-1">
                          <div>
                            <span className="text-slate-600 font-medium">Eligible branches:</span> <span className="font-normal text-slate-900">B. Tech</span>
                          </div>
                          <div>
                            <span className="text-slate-600 font-medium">Eligible Batch:</span> <span className="font-normal text-slate-900">2027</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mt-4">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-xs font-medium">
                            SQL
                          </span>
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-xs font-medium">
                            AI
                          </span>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* VERIFIED ECOSYSTEM BANNER */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="relative rounded-[28px] bg-white ring-1 ring-slate-200/50 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.08)] overflow-hidden">
          {/* Subtle background ambient glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-50 rounded-full blur-[100px] opacity-60 pointer-events-none transform translate-x-1/3 -translate-y-1/3"></div>

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200/60">
            {/* Left Column: Core Institutional Trust Narrative */}
            <div className="lg:col-span-7 p-8 sm:p-12 lg:p-14 flex flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-xs font-bold uppercase tracking-widest mb-8">
                  <HiOutlineShieldCheck size={16} />
                  <span>Verified Network</span>
                </div>
                <h3 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-[1.15] mb-6">
                  Built exclusively for trusted campus placements.
                </h3>
                <p className="text-lg text-slate-500 font-medium leading-relaxed max-w-xl">
                  PlaceHub is built exclusively for Woxsen University placements. Every student account is verified using an approved institutional email,
                  helping maintain trusted student records and ensuring recruiters interact with verified candidates.
                </p>
              </div>
            </div>

            {/* Right Column: Integrated Enterprise Specification Ledger */}
            <div className="lg:col-span-5 bg-slate-50/50 p-8 sm:p-12 lg:p-14 flex flex-col justify-center">
              <div className="space-y-8">
                {/* Row 1: Email Whitelisting */}
                <div className="pb-8 border-b border-slate-200/80">
                  <div className="flex items-center gap-3.5 mb-2.5">
                    <div className="w-10 h-10 rounded-xl bg-blue-100/80 text-blue-700 flex items-center justify-center shrink-0">
                      <HiOutlineBadgeCheck size={22} />
                    </div>
                    <h4 className="text-xl font-bold text-slate-900">
                      Institutional Email Whitelisting
                    </h4>
                  </div>
                  <p className="text-base font-medium text-slate-600 leading-relaxed pl-[54px]">
                    Only approved institutional email addresses can register, preventing unauthorized access and ensuring verified student records.
                  </p>
                </div>

                {/* Row 2: Role-Based Access Control */}
                <div>
                  <div className="flex items-center gap-3.5 mb-2.5">
                    <div className="w-10 h-10 rounded-xl bg-slate-200/80 text-slate-800 flex items-center justify-center shrink-0">
                      <HiOutlineLockClosed size={22} />
                    </div>
                    <h4 className="text-xl font-bold text-slate-900">
                      Role-Based Access Control
                    </h4>
                  </div>
                  <p className="text-base font-medium text-slate-600 leading-relaxed pl-[54px]">
                    Each user has access only to the features and information required for their role, helping protect sensitive placement data.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ASYMMETRICAL STORY CANVAS */}
      <div id="for-students" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-20">

        {/* Story Block 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tighter leading-[1.05] mb-6">
              A single source of truth for your academic identity.
            </h2>
            <p className="text-lg text-slate-500 font-medium leading-relaxed">
              Build your profile once. Track your CGPA, branch, and graduation year securely. Store an active version of your primary resume ready, to apply instantly.
            </p>
          </div>
          <div>
            <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white w-full max-w-5xl shadow-sm mx-auto">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200 bg-slate-50">
                <span className="w-3 h-3 rounded-full bg-red-400"></span>
                <span className="w-3 h-3 rounded-full bg-yellow-400"></span>
                <span className="w-3 h-3 rounded-full bg-green-400"></span>
                <span className="mx-auto text-xs text-slate-400">PlaceHub</span>
              </div>
              <div className="p-8 sm:p-12">
                <div className="flex items-center gap-6 mb-10">
                  <div className="w-16 h-16 bg-slate-50 rounded-full border border-slate-200 flex items-center justify-center text-slate-900">
                    <HiOutlineUser size={28} />
                  </div>
                  <div>
                    <div className="text-xl font-bold text-slate-900">Sai</div>
                    <div className="text-sm font-bold text-emerald-600">Institution Verified</div>
                  </div>
                </div>
                <div className="space-y-8">
                  <div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Program</div>
                    <div className="text-xl font-bold text-slate-900">B.Tech CSE '27</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Resume Document</div>
                    <div className="flex items-center gap-3 text-xl font-bold text-blue-600">
                      <HiOutlineDocumentText /> active_resume.pdf
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Story Block 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="order-2 lg:order-1">
            <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white w-full max-w-5xl shadow-sm mx-auto">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200 bg-slate-50">
                <span className="w-3 h-3 rounded-full bg-red-400"></span>
                <span className="w-3 h-3 rounded-full bg-yellow-400"></span>
                <span className="w-3 h-3 rounded-full bg-green-400"></span>
                <span className="mx-auto text-xs text-slate-400">PlaceHub</span>
              </div>
              <div className="p-8 sm:p-12">
                <div className="mb-6 flex justify-between items-start">
                  <div className="text-2xl font-bold text-slate-900">Data Analyst Intern</div>
                  <div className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded uppercase tracking-widest border border-blue-100">Matches Profile</div>
                </div>
                <div className="text-xl font-medium text-slate-500 mb-10">Diligent • Hyderabad</div>
                <div className="w-full bg-slate-900 text-white text-lg font-bold py-5 rounded-xl text-center cursor-default">
                  Apply Now
                </div>
              </div>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tighter leading-[1.05] mb-6">
              Discover and apply to drives with one click.
            </h2>
            <p className="text-lg text-slate-500 font-medium leading-relaxed">
              Browse campus drives posted by the placement cell. Check eligibility, role requirements, and job details in one place. Apply with a single click and track your progress through every stage of the process.
            </p>
          </div>
        </div>

        {/* Story Block 3 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tighter leading-[1.05] mb-6">
              Track every interview round in real-time.
            </h2>
            <p className="text-lg text-slate-500 font-medium leading-relaxed">
              No more guessing games. Watch your application statuses from In Progress to Selected or Rejected, tracking every interview round along the way.
            </p>
          </div>
          <div>
            <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white w-full max-w-5xl shadow-sm mx-auto">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200 bg-slate-50">
                <span className="w-3 h-3 rounded-full bg-red-400"></span>
                <span className="w-3 h-3 rounded-full bg-yellow-400"></span>
                <span className="w-3 h-3 rounded-full bg-green-400"></span>
                <span className="mx-auto text-xs text-slate-400">PlaceHub</span>
              </div>
              <div className="p-8 sm:p-12 space-y-10">
                <div className="flex justify-between items-center border-b border-slate-100 pb-6">
                  <div className="text-xl font-bold text-slate-900">ADP</div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-emerald-600">Selected</div>
                    <div className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-widest">Round 4</div>
                  </div>
                </div>
                <div className="flex justify-between items-center border-b border-slate-100 pb-6 opacity-60">
                  <div className="text-xl font-bold text-slate-900">HighRadius</div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-slate-500">In Progress</div>
                    <div className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-widest">Round 1</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      <div className="bg-gradient-to-b from-white via-slate-50 to-[#F4F6F8] py-4">
        {/* HIGHLIGHT PANEL: ARCHITECTURE */}
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="bg-white ring-1 ring-slate-900/5 shadow-[0_2px_40px_-8px_rgba(0,0,0,0.04)] rounded-[28px] px-8 py-10 lg:px-12">
            <div className="max-w-[800px] mx-auto">
              <h3 className="text-sm font-black text-blue-600 uppercase tracking-[0.2em] mb-6">System Architecture</h3>
              <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tighter leading-[1.05] mb-12">
                Built for scale, secured by design.
              </h2>

              <div className="space-y-12 lg:space-y-16">
                <div>
                  <h4 className="text-2xl font-bold text-slate-900 mb-4">Strict Role-Based Access</h4>
                  <p className="text-xl text-slate-500 font-medium leading-relaxed">
                    PlaceHub separates concerns strictly. Students interface with their profiles and applications. HR recruiters manage their specific placement drives. Administrators maintain global oversight of the entire portal.
                  </p>
                </div>
                <div>
                  <h4 className="text-2xl font-bold text-slate-900 mb-4">Centralized Data Persistence</h4>
                  <p className="text-xl text-slate-500 font-medium leading-relaxed">
                    All academic records, application data, and user information are stored in a unified database, while resumes are securely managed through dedicated object storage.
                    When a drive opens, relevant data flows seamlessly from the student’s profile to the recruiter’s dashboard.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <section className="bg-white py-16 lg:py-24 border-y border-slate-100">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h3 className="text-sm font-black text-blue-600 uppercase tracking-[0.2em] mb-6">Support & Questions</h3>
            <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tighter leading-[1.05] mb-12">
              Frequently asked questions
            </h2>

            <div className="space-y-0 border-y border-slate-200">
              {faqs.map((faq, i) => (
                <div key={i} className="border-b border-slate-200 last:border-0 relative">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                    className="w-full text-left py-5 px-4 -mx-4 rounded-2xl hover:bg-slate-50 transition-colors flex items-center justify-between focus:outline-none"
                  >
                    <span className={`text-xl font-bold tracking-tight transition-colors ${openFaq === i ? 'text-blue-600' : 'text-slate-900'}`}>
                      {faq.q}
                    </span>
                    <HiOutlineChevronDown
                      className={`text-slate-400 transition-transform duration-300 ${openFaq === i ? 'rotate-180' : ''}`}
                      size={24}
                    />
                  </button>
                  <div className={`overflow-hidden transition-all duration-300 ease-in-out px-4 -mx-4 ${openFaq === i ? 'max-h-[500px] pb-8 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <p className="text-lg text-slate-500 font-medium leading-relaxed pr-8">
                      {faq.a}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ABOUT PLACEHUB */}
        <div id="about" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h3 className="text-sm font-black text-blue-600 uppercase tracking-[0.2em] mb-3">About PlaceHub</h3>
            <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tighter leading-tight mb-4">
              A Better Way to Manage Campus Placements
            </h2>
            <p className="text-lg sm:text-xl text-slate-500 font-medium">
              Bringing students, the Placement Cell, and recruiters together on one platform.
            </p>
          </div>

          <div className="bg-white ring-1 ring-slate-200/80 shadow-[0_4px_36px_-8px_rgba(0,0,0,0.04)] rounded-[28px] p-8 sm:p-12 lg:p-16 max-w-4xl mx-auto">
            <div className="space-y-6 text-lg sm:text-xl text-slate-600 font-medium leading-relaxed">
              <p>
                Every placement season involves hundreds of applications, eligibility checks, recruiter interactions, and hiring updates. As placement drives grow,
                managing every stage efficiently while keeping information organized becomes increasingly challenging.
              </p>
              <p className="text-slate-900 font-semibold border-l-4 border-blue-600 pl-5 py-1 my-8">
                We believe every placement drive should be managed from one trusted platform instead of multiple separate workflows.
              </p>
              <p>
                PlaceHub was created at Woxsen University to bring students, the Placement Cell, and recruiters onto one platform.
                From verified student profiles and applications to recruiter reviews and placement updates,
                every stage of the placement journey stays connected in one platform to track.
              </p>
            </div>
          </div>
        </div>

        {/* MEET THE TEAM */}
        {SHOW_TEAM_SECTION && (
          <section id="team" className="bg-white border-y border-slate-100 py-16 lg:py-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-3xl mx-auto mb-10">
                <h3 className="text-sm font-black text-blue-600 uppercase tracking-[0.2em] mb-2">People Behind PlaceHub</h3>
                <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tighter mb-3">
                  Built by the PlaceHub Team
                </h2>
                <p className="text-lg sm:text-xl text-slate-500 font-medium">
                  Designed and developed by five students to simplify campus placements.
                </p>
              </div>

              {/* Founder */}
              <div className="flex flex-col items-center text-center max-w-md mx-auto mb-6 sm:mb-8">
                {projectFounder.photo ? (
                  <img
                    src={projectFounder.photo}
                    alt={projectFounder.name}
                    className="w-40 h-40 rounded-full object-cover border border-slate-200 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] mb-4 shrink-0"
                  />
                ) : (
                  <div
                    aria-label={`${projectFounder.name} initials avatar`}
                    className="w-40 h-40 rounded-full bg-white text-slate-800 border border-slate-200 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] flex items-center justify-center font-bold text-3xl mb-4 shrink-0 select-none"
                  >
                    {projectFounder.initials}
                  </div>
                )}
                <h4 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{projectFounder.name}</h4>
                <p className="text-base sm:text-lg font-semibold text-blue-600 mt-1">{projectFounder.role}</p>
              </div>

              {/* Contributors */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 max-w-6xl mx-auto">
                {coreTeam.map((member, i) => (
                  <div
                    key={i}
                    className="group flex flex-col items-center text-center cursor-pointer transition-all duration-300 hover:-translate-y-1 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-200 focus:ring-offset-4"
                    tabIndex={0}
                    aria-label={`Team member ${member.name}, ${member.role}`}
                  >
                    {member.photo ? (
                      <img
                        src={member.photo}
                        alt={member.name}
                        className="w-36 h-36 rounded-full object-cover border border-slate-200 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] group-hover:shadow-[0_8px_24px_-6px_rgba(0,0,0,0.12)] transition-shadow duration-300 mb-4 shrink-0"
                      />
                    ) : (
                      <div
                        className="w-36 h-36 rounded-full bg-white text-slate-800 border border-slate-200 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] group-hover:shadow-[0_8px_24px_-6px_rgba(0,0,0,0.12)] transition-shadow duration-300 flex items-center justify-center font-bold text-2xl mb-4 shrink-0 select-none"
                      >
                        {member.initials}
                      </div>
                    )}
                    <h4 className="text-xl sm:text-2xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors duration-300">{member.name}</h4>
                    <p className="text-sm sm:text-base font-medium text-slate-500 mt-1">{member.role}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* CONTACT SECTION */}
        <div id="contact" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8 lg:pb-10">
          <div className="bg-white ring-1 ring-slate-900/5 shadow-[0_2px_40px_-8px_rgba(0,0,0,0.04)] rounded-[28px] px-8 py-6 sm:px-12 sm:py-10 text-center">
            <h3 className="text-sm font-black text-blue-600 uppercase tracking-[0.2em] mb-3">PlaceHub Support</h3>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tighter mb-4">
              Need help?
            </h2>
            <p className="text-base sm:text-lg text-slate-500 font-medium max-w-xl mx-auto mb-8">
              For assistance with portal access, placement drives, account verification, or technical issues related to PlaceHub, please visit the Placement Cell during office hours.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-8 border-t border-slate-100 w-full">
              {/* Card 1: Visit Us */}
              <div className="group bg-white rounded-xl border border-slate-200/80 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.04)] p-6 sm:p-8 text-center flex flex-col items-center justify-center hover:-translate-y-1 hover:shadow-[0_8px_30px_-8px_rgba(0,0,0,0.08)] transition-all duration-300">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors flex items-center justify-center mb-4">
                  <HiOutlineLocationMarker size={24} />
                </div>
                <span className="block text-xs font-bold text-blue-600 uppercase tracking-[0.18em] mb-1.5">
                  VISIT US
                </span>
                <span className="text-lg font-bold text-slate-900">
                  Placement Cell Office
                </span>
                <span className="text-sm font-medium text-slate-500 mt-1">
                  Woxsen University
                </span>
              </div>

              {/* Card 2: Office Hours */}
              <div className="group bg-white rounded-xl border border-slate-200/80 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.04)] p-6 sm:p-8 text-center flex flex-col items-center justify-center hover:-translate-y-1 hover:shadow-[0_8px_30px_-8px_rgba(0,0,0,0.08)] transition-all duration-300">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors flex items-center justify-center mb-4">
                  <HiOutlineClock size={24} />
                </div>
                <span className="block text-xs font-bold text-blue-600 uppercase tracking-[0.18em] mb-1.5">
                  OFFICE HOURS
                </span>
                <span className="text-lg font-bold text-slate-900">
                  Monday – Friday
                </span>
                <span className="text-sm font-medium text-slate-500 mt-1">
                  9:00 AM – 5:00 PM IST
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* FINAL CTA ANCHOR */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-8 lg:pt-10 lg:pb-12">
          <div className="bg-slate-900 text-white rounded-[28px] px-8 sm:px-12 py-10 sm:py-12 text-center ring-1 ring-white/10 shadow-xl relative overflow-hidden">
            <div className="relative z-10 max-w-3xl mx-auto">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight mb-2 text-white">
                Ready to start your placement journey?
              </h2>
              <p className="max-w-xl mx-auto text-base sm:text-lg text-slate-400 font-medium mb-6">
                Manage your academic profile, track applications, and stay updated on placement drives, all in one workspace.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                {(loading || networkError) ? (
                  <div className="h-11 w-40 bg-white/20 rounded-xl animate-pulse" />
                ) : user ? (
                  <Link to={dashboardPath} className="px-7 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 transition-colors duration-200 w-full sm:w-auto text-sm shadow-md">
                    Go to Dashboard
                  </Link>
                ) : (
                  <>
                    <Link to="/register" className="px-7 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 transition-colors duration-200 w-full sm:w-auto text-sm shadow-md">
                      Get Started
                    </Link>
                    <Link to="/login" className="px-7 py-3 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition-colors duration-200 w-full sm:w-auto text-sm">
                      Sign In →
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}