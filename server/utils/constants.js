const SCHOOLS = [
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

const getAllowedYears = () => {
  const baseStart = 2026;
  const currentYear = new Date().getFullYear();
  const start = Math.max(baseStart, currentYear);
  const end = start + 10;

  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
};

module.exports = {
  SCHOOLS,
  getAllowedYears
};
