import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getWhitelistDbList } from '../services/adminService';
import { getResponseData } from '../services/api';

export function useWhitelist(search, page) {
  return useQuery({
    queryKey: ['whitelist', search, page],
    queryFn: async () => {
      const response = await getWhitelistDbList({ search, page, limit: 50 });
      const payload = getResponseData(response) || {};
      return payload || { emails: [], pagination: { total: 0 } };
    },
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 2,
  });
}
