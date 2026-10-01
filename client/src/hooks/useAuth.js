import { useCallback, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuth as useAuthContext } from '../context/AuthContext';
import { getErrorMessage } from '../services/api';

export const useAuth = () => {
  const { login, ...rest } = useAuthContext();
  const [loginError, setLoginError] = useState('');

  const loginMutation = useMutation({
    mutationFn: ({ identifier, password }) => login(identifier, password),
    onMutate: () => {
      setLoginError('');
    },
    onError: (error) => {
      setLoginError(getErrorMessage(error, 'Login failed'));
    },
  });

  const loginWithCredentials = useCallback(
    async (identifier, password) => {
      setLoginError('');
      try {
        const data = await loginMutation.mutateAsync({ identifier, password });
        return { data, error: null };
      } catch (error) {
        const message = getErrorMessage(error, 'Login failed');
        setLoginError(message);
        return { data: null, error: message };
      }
    },
    [loginMutation]
  );

  return {
    ...rest,
    login,
    loginLoading: loginMutation.isPending,
    loginError,
    loginWithCredentials,
  };
};
