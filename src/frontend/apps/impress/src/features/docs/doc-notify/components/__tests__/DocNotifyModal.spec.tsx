import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Doc } from '@/docs/doc-management';
import { AppWrapper } from '@/tests/utils';

import { DocNotifyModal } from '../DocNotifyModal';

const doc = {
  id: 'document-42',
  title: 'Project roadmap',
} as Doc;

describe('<DocNotifyModal />', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('updates every form control and saves the choices locally', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { unmount } = render(<DocNotifyModal doc={doc} onClose={onClose} />, {
      wrapper: AppWrapper,
    });

    await user.click(screen.getByRole('tab', { name: 'Settings' }));

    const documentDetails = screen.getByRole('checkbox', {
      name: 'ID and document name',
    });
    const confidentialityWarning = screen.getByRole('checkbox', {
      name: 'Include a confidentiality warning for webhooks',
    });

    expect(documentDetails).toBeChecked();
    expect(confidentialityWarning).not.toBeChecked();

    await user.click(screen.getByText('Date and time'));
    expect(
      screen.getByRole('checkbox', { name: 'Date and time' }),
    ).not.toBeChecked();

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(6);
    for (const checkbox of checkboxes) {
      await user.click(checkbox);
    }

    expect(
      screen.getByRole('checkbox', { name: 'Date and time' }),
    ).toBeChecked();

    expect(documentDetails).not.toBeChecked();
    expect(confidentialityWarning).toBeChecked();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Frequency' }),
      'weekly',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Notification channel' }),
      'both',
    );
    await user.click(screen.getByRole('button', { name: 'Done' }));

    expect(onClose).toHaveBeenCalledOnce();
    unmount();

    render(<DocNotifyModal doc={doc} onClose={vi.fn()} />, {
      wrapper: AppWrapper,
    });
    await user.click(screen.getByRole('tab', { name: 'Settings' }));

    expect(
      screen.getByRole('checkbox', { name: 'ID and document name' }),
    ).not.toBeChecked();
    expect(
      screen.getByRole('checkbox', {
        name: 'Include a confidentiality warning for webhooks',
      }),
    ).toBeChecked();
    expect(screen.getByRole('combobox', { name: 'Frequency' })).toHaveValue(
      'weekly',
    );
    expect(
      screen.getByRole('combobox', { name: 'Notification channel' }),
    ).toHaveValue('both');
  });

  it('hides the detailed settings when notifications are disabled', async () => {
    const user = userEvent.setup();
    render(<DocNotifyModal doc={doc} onClose={vi.fn()} />, {
      wrapper: AppWrapper,
    });

    const activationSwitch = screen.getByRole('switch', {
      name: 'Enable notifications for this document',
    });
    expect(activationSwitch).toBeChecked();

    await user.click(activationSwitch);
    expect(activationSwitch).not.toBeChecked();
    await user.click(screen.getByRole('tab', { name: 'Settings' }));

    expect(
      screen.getByText(
        'Notifications are currently disabled. Enable them in the Notifications tab to access settings.',
      ),
    ).toBeVisible();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });
});
