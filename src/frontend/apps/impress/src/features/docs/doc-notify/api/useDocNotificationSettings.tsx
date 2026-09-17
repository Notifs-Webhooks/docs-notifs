import {
  UseMutationOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

export type DigestFrequency = 'hourly' | 'weekly' | 'monthly';
export type SubscriptionStatus =
  | 'disabled'
  | 'pending'
  | 'active'
  | 'revoked'
  | 'error'
  | 'not_found'
  | 'unavailable';

export type DocNotificationSettings = {
  enabled: boolean;
  frequency: DigestFrequency;
  last_sent_at: string | null;
  subscription_status: SubscriptionStatus;
};

type SettingsParams = { id: string };
type UpdateSettingsParams = SettingsParams & { frequency: DigestFrequency };

export const KEY_DOC_NOTIFICATION_SETTINGS = 'doc-notification-settings';

const endpoint = (id: string) => `documents/${id}/notification-settings/`;

const parseResponse = async (
  response: Response,
  errorMessage: string,
): Promise<DocNotificationSettings> => {
  if (!response.ok) {
    throw new APIError(errorMessage, await errorCauses(response));
  }
  return response.json() as Promise<DocNotificationSettings>;
};

export const getDocNotificationSettings = async ({ id }: SettingsParams) =>
  parseResponse(
    await fetchAPI(endpoint(id)),
    'Failed to load document notification settings',
  );

export const updateDocNotificationSettings = async ({
  id,
  frequency,
}: UpdateSettingsParams) =>
  parseResponse(
    await fetchAPI(endpoint(id), {
      method: 'PUT',
      body: JSON.stringify({ frequency }),
    }),
    'Failed to enable document notifications',
  );

export const disableDocNotificationSettings = async ({ id }: SettingsParams) =>
  parseResponse(
    await fetchAPI(endpoint(id), { method: 'DELETE' }),
    'Failed to disable document notifications',
  );

export const useDocNotificationSettings = (id: string) =>
  useQuery<DocNotificationSettings, APIError>({
    queryKey: [KEY_DOC_NOTIFICATION_SETTINGS, id],
    queryFn: () => getDocNotificationSettings({ id }),
  });

export const useUpdateDocNotificationSettings = (
  options?: UseMutationOptions<
    DocNotificationSettings,
    APIError,
    UpdateSettingsParams
  >,
) => {
  const queryClient = useQueryClient();
  return useMutation<DocNotificationSettings, APIError, UpdateSettingsParams>({
    mutationFn: updateDocNotificationSettings,
    ...options,
    onSuccess: (data, variables, context, mutation) => {
      queryClient.setQueryData(
        [KEY_DOC_NOTIFICATION_SETTINGS, variables.id],
        data,
      );
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
};

export const useDisableDocNotificationSettings = (
  options?: UseMutationOptions<
    DocNotificationSettings,
    APIError,
    SettingsParams
  >,
) => {
  const queryClient = useQueryClient();
  return useMutation<DocNotificationSettings, APIError, SettingsParams>({
    mutationFn: disableDocNotificationSettings,
    ...options,
    onSuccess: (data, variables, context, mutation) => {
      queryClient.setQueryData(
        [KEY_DOC_NOTIFICATION_SETTINGS, variables.id],
        data,
      );
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
};
