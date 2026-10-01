import { useQuery } from "@tanstack/react-query";
import api from "../services/api";
import { handleApiResponse } from '../utils/apiHandler';

export const useBulkOperation = (operationId) => {
  return useQuery({
    queryKey: ["bulkOperation", operationId],
    queryFn: async () => {
      const res = await api.get(`/bulk-operations/${operationId}`);
      return handleApiResponse(res);
    },
    enabled: !!operationId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 2000;
      return data.status === "IN_PROGRESS" ? 2000 : false;
    },
  });
};
