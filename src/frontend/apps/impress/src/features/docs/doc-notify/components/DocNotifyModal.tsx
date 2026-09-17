import { Button, Modal, ModalSize } from '@gouvfr-lasuite/ui-components';
import { announce } from '@react-aria/live-announcer';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styled, { createGlobalStyle, css } from 'styled-components';

import { Box, ButtonCloseModal, HorizontalSeparator, Text } from '@/components';
import { Doc } from '@/docs/doc-management';
import { useResponsiveStore } from '@/stores';

import {
  DigestFrequency,
  DocNotificationSettings,
  useDisableDocNotificationSettings,
  useDocNotificationSettings,
  useUpdateDocNotificationSettings,
} from '../api';

const NotifyModalStyle = createGlobalStyle`
  .--docs--doc-notify-modal .c__modal__title {
    padding-bottom: 0 !important;
  }
`;

const SwitchButton = styled.button`
  appearance: none;
  align-items: center;
  background: transparent;
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  display: inline-flex;
  margin: 0;
  opacity: ${({ disabled }) => (disabled ? 0.55 : 1)};
  padding: 0;
  user-select: none;
`;

const SwitchTrack = styled.span<{ $checked: boolean }>`
  background-color: ${({ $checked }) =>
    $checked
      ? 'var(--c--theme--colors--primary-500, #000091)'
      : 'var(--c--theme--colors--greyscale-400, #929292)'};
  border-radius: 999px;
  display: inline-block;
  flex-shrink: 0;
  height: 22px;
  position: relative;
  transition: background-color 0.15s ease;
  width: 40px;

  ${SwitchButton}:focus-visible & {
    outline: 2px solid var(--c--theme--colors--primary-500, #000091);
    outline-offset: 2px;
  }
`;

const SwitchThumb = styled.span<{ $checked: boolean }>`
  background-color: #fff;
  border-radius: 50%;
  height: 18px;
  left: ${({ $checked }) => ($checked ? '20px' : '2px')};
  position: absolute;
  top: 2px;
  transition: left 0.15s ease;
  width: 18px;
`;

const TabButton = styled.button<{ $active: boolean }>`
  background: none;
  border: 0;
  border-bottom: 2px solid
    ${({ $active }) =>
      $active
        ? 'var(--c--theme--colors--primary-500, #000091)'
        : 'transparent'};
  cursor: pointer;
  font-weight: ${({ $active }) => ($active ? 600 : 400)};
  margin-bottom: -1px;
  padding: 12px 16px;
`;

const Select = styled.select`
  background-color: #fff;
  border: 1px solid var(--c--theme--colors--greyscale-300, #e5e5e5);
  border-radius: 4px;
  font-size: 14px;
  padding: 8px 12px;
  width: 100%;
`;

type Props = { doc: Doc; onClose: () => void };
type TabKey = 'activation' | 'settings';

const DEFAULT_SETTINGS: DocNotificationSettings = {
  enabled: false,
  frequency: 'hourly',
  last_sent_at: null,
  subscription_status: 'disabled',
};

export const DocNotifyModal = ({ doc, onClose }: Props) => {
  const { t } = useTranslation();
  const { isLargeScreen } = useResponsiveStore();
  const [activeTab, setActiveTab] = useState<TabKey>('activation');
  const [settings, setSettings] =
    useState<DocNotificationSettings>(DEFAULT_SETTINGS);
  const query = useDocNotificationSettings(doc.id);
  const updateMutation = useUpdateDocNotificationSettings();
  const disableMutation = useDisableDocNotificationSettings();
  const isSaving = updateMutation.isPending || disableMutation.isPending;

  useEffect(() => {
    if (query.data) {
      setSettings(query.data);
    }
  }, [query.data]);

  const enableNotifications = (frequency: DigestFrequency) => {
    updateMutation.mutate(
      { id: doc.id, frequency },
      {
        onSuccess: (data) => {
          setSettings(data);
          announce(
            data.subscription_status === 'pending'
              ? t('Tchap invitation sent. Accept it to receive digests.')
              : t('Document notifications enabled.'),
            'polite',
          );
        },
        onError: () =>
          announce(t('Failed to enable document notifications.'), 'assertive'),
      },
    );
  };

  const disableNotifications = () => {
    disableMutation.mutate(
      { id: doc.id },
      {
        onSuccess: (data) => {
          setSettings(data);
          announce(t('Document notifications disabled.'), 'polite');
        },
        onError: () =>
          announce(t('Failed to disable document notifications.'), 'assertive'),
      },
    );
  };

  const toggleNotifications = () => {
    if (settings.enabled) {
      disableNotifications();
    } else {
      enableNotifications(settings.frequency);
    }
  };

  const updateFrequency = (frequency: DigestFrequency) => {
    const previousFrequency = settings.frequency;
    setSettings((current) => ({ ...current, frequency }));
    updateMutation.mutate(
      { id: doc.id, frequency },
      {
        onSuccess: setSettings,
        onError: () => {
          setSettings((current) => ({
            ...current,
            frequency: previousFrequency,
          }));
          announce(t('Failed to update digest frequency.'), 'assertive');
        },
      },
    );
  };

  const statusMessage = (() => {
    if (query.isLoading) {
      return t('Loading notification settings…');
    }
    if (query.isError) {
      return t('Notification settings could not be loaded.');
    }
    if (settings.subscription_status === 'pending') {
      return t(
        'An invitation was sent to @bob:localhost. Accept it in Tchap to receive digests.',
      );
    }
    if (settings.subscription_status === 'active') {
      return t('Tchap delivery is active for this document.');
    }
    if (settings.subscription_status === 'unavailable') {
      return t('Tchap Notifier is currently unavailable.');
    }
    if (
      settings.enabled &&
      ['revoked', 'error', 'not_found'].includes(settings.subscription_status)
    ) {
      return t(
        'Tchap authorization is no longer active. Disable and enable notifications to send a new invitation.',
      );
    }
    return t('No digest is configured for this document.');
  })();

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'activation', label: t('Notifications') },
    { key: 'settings', label: t('Settings') },
  ];

  return (
    <Modal
      isOpen
      closeOnClickOutside
      data-testid="doc-notify-modal"
      data-doc-id={doc.id}
      aria-label={t('Notification settings for document {{docTitle}}', {
        docTitle: doc.title,
      })}
      size={isLargeScreen ? ModalSize.MEDIUM : ModalSize.FULL}
      aria-modal="true"
      onClose={onClose}
      title={
        <Box $direction="row" $justify="space-between" $align="center">
          <Text as="h1" $size="small" $weight="600" $margin="0">
            {t('Notifications')}
          </Text>
          <ButtonCloseModal
            aria-label={t('Close the notification settings window')}
            onClick={onClose}
          />
        </Box>
      }
      hideCloseButton
    >
      <NotifyModalStyle />
      <Box className="--docs--doc-notify-modal noPadding">
        <Box
          $direction="row"
          $padding={{ horizontal: 'base' }}
          $css={css`
            border-bottom: 1px solid
              var(--c--theme--colors--greyscale-200, #e5e5e5);
          `}
          role="tablist"
          aria-label={t('Notification settings tabs')}
        >
          {tabs.map((tab) => (
            <TabButton
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              $active={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </TabButton>
          ))}
        </Box>

        <Box $padding={{ horizontal: 'base', vertical: 'base' }} $gap="1.25rem">
          {activeTab === 'activation' && (
            <Box $gap="0.75rem">
              <Box
                $direction="row"
                $align="center"
                $justify="space-between"
                $padding={{ vertical: 'sm' }}
              >
                <Box $gap="4px">
                  <Text $weight="600" $size="sm">
                    {t('Enable notifications')}
                  </Text>
                  <Text $variation="secondary" $size="xs">
                    {t('Receive Tchap digests when this document changes.')}
                  </Text>
                </Box>
                <SwitchButton
                  type="button"
                  role="switch"
                  aria-checked={settings.enabled}
                  aria-label={t('Enable notifications for this document')}
                  disabled={query.isLoading || isSaving}
                  onClick={toggleNotifications}
                >
                  <SwitchTrack $checked={settings.enabled} aria-hidden="true">
                    <SwitchThumb $checked={settings.enabled} />
                  </SwitchTrack>
                </SwitchButton>
              </Box>
              <Text $variation="secondary" $size="xs" role="status">
                {statusMessage}
              </Text>
            </Box>
          )}

          {activeTab === 'settings' && (
            <Box $gap="1.25rem">
              {!settings.enabled ? (
                <Text $variation="secondary" $size="sm">
                  {t(
                    'Enable notifications in the Notifications tab to configure the digest.',
                  )}
                </Text>
              ) : (
                <>
                  <Box $gap="0.35rem">
                    <label htmlFor="doc-notify-frequency">
                      <Text $size="sm" $weight="600">
                        {t('Digest frequency')}
                      </Text>
                    </label>
                    <Select
                      id="doc-notify-frequency"
                      value={settings.frequency}
                      disabled={isSaving}
                      onChange={(event) =>
                        updateFrequency(event.target.value as DigestFrequency)
                      }
                    >
                      <option value="hourly">{t('Hourly')}</option>
                      <option value="weekly">{t('Weekly')}</option>
                      <option value="monthly">{t('Monthly')}</option>
                    </Select>
                  </Box>
                  <Box $gap="0.35rem">
                    <Text $size="sm" $weight="600">
                      {t('Digest content')}
                    </Text>
                    <Text $variation="secondary" $size="xs">
                      {t(
                        'Each digest includes the document name, number of saved updates, contributors, covered period, and a link to the document.',
                      )}
                    </Text>
                    <Text $variation="secondary" $size="xs">
                      {t('Empty periods do not generate a message.')}
                    </Text>
                  </Box>
                </>
              )}
            </Box>
          )}

          <HorizontalSeparator $margin={{ vertical: 'xs' }} />
          <Box $direction="row" $justify="flex-end">
            <Button color="brand" onClick={onClose}>
              {t('Done')}
            </Button>
          </Box>
        </Box>
      </Box>
    </Modal>
  );
};
