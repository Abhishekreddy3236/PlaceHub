import { useQuery, keepPreviousData } from '@tanstack/react-query';
import api from '../services/api';
import { handleApiResponse } from '../utils/apiHandler';

export const useStudents = ({ page, limit, search, branch, minCgpa, maxCgpa, schools, graduationYears }) => {
  return useQuery({
    queryKey: [
      'students',
      {
        page: page || 1,
        limit: limit || 50,
        search: search || '',
        branch: branch || '',
        minCgpa: minCgpa ?? null,
        maxCgpa: maxCgpa ?? null,
        schools: schools || '',
        graduationYears: graduationYears || '',
      },
    ],

    queryFn: async ({ signal }) => {
      const params = { page, limit };

      if (search) params.search = search;
      if (branch) params.branch = branch;
      if (minCgpa) params.minCgpa = minCgpa;
      if (maxCgpa) params.maxCgpa = maxCgpa;
      if (schools) params.schools = schools;
      if (graduationYears) params.graduationYears = graduationYears;

      const res = await api.get('/admin/students', { params, signal });
      const data = handleApiResponse(res);

      const safeStudents = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.students)
        ? data.students
        : [];

      const safeTotal =
        typeof data?.total === 'number' && data.total >= 0
          ? data.total
          : safeStudents.length;

      const safeLimit =
        typeof data?.limit === 'number' && data.limit > 0 ? data.limit : limit || 50;

      return {
        students: safeStudents,
        total: safeTotal,
        limit: safeLimit,
      };
    },

    placeholderData: keepPreviousData,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
};
