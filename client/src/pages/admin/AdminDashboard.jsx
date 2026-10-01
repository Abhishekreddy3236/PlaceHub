import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { HiOutlineBriefcase, HiOutlineChartBar, HiOutlineClipboardCheck, HiOutlineExclamationCircle, HiOutlineTrendingUp, HiOutlineUsers, HiOutlinePlus } from 'react-icons/hi';
import toast from 'react-hot-toast';
import { adminApi, getErrorMessage, getResponseData } from '../../services/api';
import Loader from '../../components/common/Loader';
import { GLOBAL_APPLICANTS_ENABLED } from '../../config/features';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const numberFormat = new Intl.NumberFormat('en-IN');

const chartColors = {
  blue: '#2563eb',
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  slate: '#64748b',
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadStats = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await adminApi.getDashboardStats();
      const data = getResponseData(response);
      setStats(data || {});
    } catch (err) {
      const message = getErrorMessage(err, 'Failed to load admin dashboard');
      setError(message || '');
      if (message) toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const cards = useMemo(
    () => [
      {
        label: 'Students',
        value: stats?.totalStudents || 0,
        icon: HiOutlineUsers,
        tone: 'blue',
        to: '/admin/students',
      },
      {
        label: 'Jobs',
        value: stats?.totalJobs || 0,
        icon: HiOutlineBriefcase,
        tone: 'green',
        to: '/admin/jobs',
      },
      {
        label: 'Applications',
        value: stats?.totalApplications || 0,
        icon: HiOutlineClipboardCheck,
        tone: 'amber',
        to: GLOBAL_APPLICANTS_ENABLED ? '/admin/applicants' : null,
      },
      {
        label: 'In Progress',
        value: stats?.inProgress || 0,
        icon: HiOutlineTrendingUp,
        tone: 'blue',
        to: GLOBAL_APPLICANTS_ENABLED ? '/admin/applicants' : null,
      },
      {
        label: 'Rejected',
        value: stats?.rejected || 0,
        icon: HiOutlineExclamationCircle,
        tone: 'red',
        to: GLOBAL_APPLICANTS_ENABLED ? '/admin/applicants' : null,
      },
    ],
    [stats]
  );

  const companies = useMemo(() => {
    return Array.isArray(stats?.companies)
      ? stats.companies.filter((item) => item && item.count !== undefined)
      : [];
  }, [stats]);

  const barData = useMemo(
    () => ({
      labels: companies.map((item) => item._id || item.company || 'Unknown'),
      datasets: [
        {
          label: 'Applications',
          data: companies.map((item) => Number(item.count) || 0),
          backgroundColor: '#2563eb',
          hoverBackgroundColor: '#1d4ed8',
          borderRadius: 6,
          maxBarThickness: companies.length === 1 ? 60 : 36,
        },
      ],
    }),
    [companies]
  );

  const statusData = useMemo(() => {
    const inProgress = stats?.inProgress || 0;
    const rejected = stats?.rejected || 0;
    const selected = stats?.selected || 0;

    return {
      labels: ['In Progress', 'Rejected', 'Selected'],
      datasets: [
        {
          data: [inProgress, rejected, selected],
          backgroundColor: [chartColors.blue, chartColors.red, chartColors.green],
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 6,
        },
      ],
    };
  }, [stats]);

  const barOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a',
          padding: 12,
          cornerRadius: 8,
          titleFont: { size: 13, family: "ui-sans-serif, system-ui, sans-serif" },
          bodyFont: { size: 13, family: "ui-sans-serif, system-ui, sans-serif" },
          callbacks: {
            label: (context) => `${numberFormat.format(context.raw || 0)} applications`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: chartColors.slate, maxRotation: 0, autoSkip: true, font: { family: "ui-sans-serif, system-ui, sans-serif" } },
        },
        y: {
          beginAtZero: true,
          ticks: { precision: 0, color: chartColors.slate, font: { family: "ui-sans-serif, system-ui, sans-serif" }, padding: 8 },
          grid: { color: '#f1f5f9', drawTicks: false },
          border: { display: false, dash: [4, 4] },
        },
      },
      interaction: {
        mode: 'index',
        intersect: false,
      },
    }),
    []
  );

  const doughnutOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            usePointStyle: true,
            padding: 20,
            font: { family: "ui-sans-serif, system-ui, sans-serif", size: 13 },
            color: '#475569',
          },
        },
        tooltip: {
          backgroundColor: '#0f172a',
          padding: 12,
          cornerRadius: 8,
          titleFont: { size: 13, family: "ui-sans-serif, system-ui, sans-serif" },
          bodyFont: { size: 13, family: "ui-sans-serif, system-ui, sans-serif" },
        },
      },
      cutout: '75%',
    }),
    []
  );



  const toneStyles = {
    blue: 'text-blue-600',
    green: 'text-emerald-600',
    amber: 'text-amber-500',
    red: 'text-red-500',
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-white text-blue-600 flex items-center justify-center shrink-0 border border-slate-200 shadow-sm">
            <HiOutlineChartBar className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">Admin Dashboard</h1>
            <p className="text-sm font-medium text-slate-500 mt-1">Monitor student placements, applications, and recruitment progress.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/admin/jobs/new" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-all hover:-translate-y-0.5 hover:shadow-md">
            <HiOutlinePlus className="-ml-0.5 h-5 w-5" strokeWidth={2} aria-hidden="true" />
            Add Job
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {(loading && !stats ? Array.from({ length: 5 }) : cards).map((card, index) => {
          if (loading && !stats) {
            return (
              <div
                key={index}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex items-center justify-between min-h-[96px]"
              >
                <div className="flex flex-col gap-2">
                  <div className="h-4 w-20 bg-slate-100 rounded animate-pulse" />
                  <div className="h-8 w-14 bg-slate-100 rounded animate-pulse" />
                </div>
                <div className="h-12 w-12 rounded-xl bg-slate-100 animate-pulse shrink-0" />
              </div>
            );
          }

          const Icon = card.icon;
          const toneClass = toneStyles[card.tone] || toneStyles.blue;

          const CardComponent = card.to ? Link : 'div';

          return (
            <CardComponent
              key={card.label}
              {...(card.to ? { to: card.to } : {})}
              className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-semibold text-slate-500 tracking-wide">{card.label}</div>
                <div className={`${toneStyles[card.tone]} transition-transform duration-300 group-hover:scale-110 opacity-90`}>
                  <Icon size={22} strokeWidth={2} />
                </div>
              </div>
              <div className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
                {numberFormat.format(card.value)}
              </div>
            </CardComponent>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)] mt-2">
        <section className="rounded-xl border border-slate-200/80 bg-white p-6 md:p-8 shadow-sm flex flex-col transition-shadow hover:shadow-md">
          <div className="mb-8">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Most Applied Companies</h2>
            <p className="text-sm text-slate-500 mt-1">Companies ranked by student application count</p>
          </div>

          <div className="h-[320px] w-full mt-auto">
            {loading && !stats ? (
              <div className="w-full h-full bg-slate-50 rounded-lg animate-pulse" />
            ) : companies.length > 0 ? (
              <Bar data={barData} options={barOptions} />
            ) : (
              <div className="h-full border border-dashed border-slate-200 bg-slate-50 rounded-xl p-6 flex flex-col items-center justify-center text-center">
                <div className="h-12 w-12 rounded-full bg-white shadow-sm flex items-center justify-center mb-3">
                  <HiOutlineBriefcase className="h-6 w-6 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-900">Not enough data</p>
                <p className="text-xs text-slate-500 mt-1">More activity will unlock insights</p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200/80 bg-white p-6 md:p-8 shadow-sm flex flex-col transition-shadow hover:shadow-md">
          <div className="mb-8">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Application Status</h2>
          </div>

          <div className="h-[320px] w-full mt-auto">
            {loading && !stats ? (
              <div className="w-full h-full bg-slate-50 rounded-lg animate-pulse" />
            ) : stats && (stats.inProgress > 0 || stats.rejected > 0 || stats.selected > 0) ? (
              <Doughnut data={statusData} options={doughnutOptions} />
            ) : (
              <div className="h-full border border-dashed border-slate-200 bg-slate-50 rounded-xl p-6 flex flex-col items-center justify-center text-center">
                <div className="h-12 w-12 rounded-full bg-white shadow-sm flex items-center justify-center mb-3">
                  <HiOutlineClipboardCheck className="h-6 w-6 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-900">Not enough data</p>
                <p className="text-xs text-slate-500 mt-1">More activity will unlock insights</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
