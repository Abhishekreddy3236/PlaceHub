import { HiOutlineRefresh } from "react-icons/hi";

export default function RefreshButton({ onClick, loading = false, fetching = false, hideLabelOnMobile = false }) {
  const isLoading = loading || fetching;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      title="Refresh"
      className={`btn-secondary inline-flex items-center justify-center ${
        hideLabelOnMobile ? "p-2 sm:px-3 sm:py-2 sm:gap-2" : "gap-2 px-3 py-2"
      } text-sm disabled:opacity-50`}
    >
      <HiOutlineRefresh
        size={18}
        className={isLoading ? "animate-spin" : ""}
      />
      <span className={hideLabelOnMobile ? "hidden sm:inline" : ""}>Refresh</span>
    </button>
  );
}
