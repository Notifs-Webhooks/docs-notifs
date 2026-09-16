import { useMutation } from '@tanstack/react-query';
import { validate as uuidValidate } from 'uuid';

import { APIError, errorCauses, fetchAPI } from '@/api';

import { Doc } from '../types';

export type ReportDocContributionParams = Pick<Doc, 'id'>;

export const reportDocContribution = async ({
  id,
}: ReportDocContributionParams): Promise<void> => {
  if (!uuidValidate(id)) {
    throw new Error(`Invalid doc id in reportDocContribution: ${id}`);
  }

  const response = await fetchAPI(`documents/${id}/contributions/`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new APIError(
      'Failed to report the document contribution',
      await errorCauses(response),
    );
  }
};

export function useReportDocContribution() {
  return useMutation<void, APIError, ReportDocContributionParams>({
    mutationFn: reportDocContribution,
  });
}
