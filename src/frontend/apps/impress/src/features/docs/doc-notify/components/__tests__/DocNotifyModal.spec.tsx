import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Doc } from '@/docs/doc-management';
import { AppWrapper } from '@/tests/utils';

import { DocNotificationSettings } from '../../api';
import { DocNotifyModal } from '../DocNotifyModal';

const updateSettings = vi.fn();
const disableSettings = vi.fn();
let backendSettings: DocNotificationSettings;

vi.mock('../../api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../api')>();
  return {
    ...original,
    useDocNotificationSettings: () => ({
      data: backendSettings,
      isLoading: false,
      isError: false,
    }),
    useUpdateDocNotificationSettings: () => ({
      isPending: false,
      mutate: updateSettings,
    }),
    useDisableDocNotificationSettings: () => ({
      isPending: false,
      mutate: disableSettings,
    }),
  };
});

const doc = { id: 'document-42', title: 'Project roadmap' } as Doc;

describe('<DocNotifyModal />', () => {
  beforeEach(() => {
    backendSettings = {
      enabled: false,
      frequency: 'hourly',
      last_sent_at: null,
      subscription_status: 'disabled',
    };
    updateSettings.mockReset();
    disableSettings.mockReset();
    updateSettings.mockImplementation((_variables, options) => {
      options.onSuccess({
        ...backendSettings,
        enabled: true,
        subscription_status: 'pending',
      });
    });
    disableSettings.mockImplementation((_variables, options) => {
      options.onSuccess(backendSettings);
    });
  });

  it('enables and disables the backend subscription from the switch', async () => {
    const user = userEvent.setup();
    render(<DocNotifyModal doc={doc} onClose={vi.fn()} />, {
      wrapper: AppWrapper,
    });

    const toggle = screen.getByRole('switch', {
      name: 'Enable notifications for this document',
    });
    expect(toggle).not.toBeChecked();

    await user.click(toggle);
    expect(updateSettings).toHaveBeenCalledWith(
      { id: doc.id, frequency: 'hourly' },
      expect.any(Object),
    );
    expect(toggle).toBeChecked();
    expect(
      screen.getByText(/invitation was sent to @bob:localhost/i),
    ).toBeVisible();

    await user.click(toggle);
    expect(disableSettings).toHaveBeenCalledWith(
      { id: doc.id },
      expect.any(Object),
    );
    expect(toggle).not.toBeChecked();
  });

  it('only exposes supported digest settings', async () => {
    backendSettings = {
      enabled: true,
      frequency: 'weekly',
      last_sent_at: null,
      subscription_status: 'active',
    };
    const user = userEvent.setup();
    render(<DocNotifyModal doc={doc} onClose={vi.fn()} />, {
      wrapper: AppWrapper,
    });

    await user.click(screen.getByRole('tab', { name: 'Settings' }));
    const frequency = screen.getByRole('combobox', {
      name: 'Digest frequency',
    });
    expect(frequency).toHaveValue('weekly');
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(screen.queryByText('Instantaneous')).not.toBeInTheDocument();
    expect(screen.queryByText('Email only')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);

    await user.selectOptions(frequency, 'monthly');
    expect(updateSettings).toHaveBeenCalledWith(
      { id: doc.id, frequency: 'monthly' },
      expect.any(Object),
    );
    expect(
      screen.getByText(/document name, number of saved updates, contributors/i),
    ).toBeVisible();
  });
});
