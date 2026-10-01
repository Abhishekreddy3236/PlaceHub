import { Link } from 'react-router-dom';
import { FaLinkedinIn } from 'react-icons/fa';
import Logo from '../ui/Logo';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-slate-100 py-8 sm:py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 sm:gap-4">

          {/* Column 1: Logo */}
          <div className="w-full sm:w-1/3 flex justify-center sm:justify-start">
            <Link to="/" className="flex items-center">
              <Logo className="h-7" />
            </Link>
          </div>

          {/* Column 2: Copyright */}
          <div className="w-full sm:w-1/3 flex justify-center text-center">
            <p className="text-sm font-medium text-slate-500">
              &copy; {new Date().getFullYear()} PlaceHub. All rights reserved.
            </p>
          </div>

          {/* Column 3: Social */}
          <div className="w-full sm:w-1/3 flex justify-center sm:justify-end">
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="PlaceHub on LinkedIn"
              className="w-10 h-10 rounded-full border border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-50 flex items-center justify-center transition-all duration-300 hover:-translate-y-[1px]"
            >
              <FaLinkedinIn size={16} />
            </a>
          </div>

        </div>
      </div>
    </footer>
  );
}
