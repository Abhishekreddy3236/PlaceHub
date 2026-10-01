export const SCHOOLS = [
  'MBA',
  'B. Tech',
  'BBA/BBA(Hons.)',
  'BBA-LLB(Hons.)',
  'BA-LLB (Hons.)',
  'BA (Hons.)',
  'B.Des (Hons.)',
  'B.Sc (Hons.)',
  'BCA',
  'M.Tech (AI & ML)',
  'M.Des (Product Design Innovation)',
  'B.Arch',
  'B.Sc Sports Science',
  'Master’s in Healthcare Planning & Design'
];

export const getAllowedYears = () => {
  const baseStart = 2026;
  const currentYear = new Date().getFullYear();
  const start = Math.max(baseStart, currentYear);
  const end = start + 10;
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
};

// Toggle this boolean (true / false) to show or hide the Team section in both Home and Navbar
export const SHOW_TEAM_SECTION = false;
