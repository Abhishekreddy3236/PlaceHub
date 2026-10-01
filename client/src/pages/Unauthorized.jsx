import { Link } from 'react-router-dom';

export default function Unauthorized() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Unauthorized</h1>
        <p className="mt-2 text-sm text-slate-600">
          Your account does not have permission to view this page.
        </p>
        <Link to="/" className="btn-primary mt-6 inline-flex text-sm">
          Go Home
        </Link>
      </div>
    </div>
  );
}
