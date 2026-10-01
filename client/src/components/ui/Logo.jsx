export default function Logo({ className = "h-10" }) {
  return (
    <svg
      className={`w-auto ${className}`}
      viewBox="0 0 500 110"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMinYMid meet"
    >
      <defs>
        {/* Dark gradient for "Place" */}
        <linearGradient id="placeGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#020617" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>

        {/* Blue gradient for "Hub" */}
        <linearGradient id="hubGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
      </defs>

      {/* Place */}
      <text
        x="0"
        y="78"
        fontFamily="Inter, Satoshi, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif"
        fontSize="80"
        fontWeight="900"
        fill="url(#placeGradient)"
        letterSpacing="-1.5"
      >
        Place
      </text>

      {/* Hub */}
      <text
        x="214"
        y="78"
        fontFamily="Inter, Satoshi, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif"
        fontSize="80"
        fontWeight="900"
        fill="url(#hubGradient)"
        letterSpacing="-1.5"
      >
        Hub
      </text>
    </svg>
  );
}