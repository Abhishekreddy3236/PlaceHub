export const handleApiResponse = (response) => {
  const payload = response?.data;

  if (!payload?.success) {
    throw new Error(payload?.message || 'API failed');
  }

  return payload.data;
};
