import { Button, Modal, ModalSize } from '@gouvfr-lasuite/ui-components';
import { announce } from '@react-aria/live-announcer';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createGlobalStyle, css } from 'styled-components';

import { Box, ButtonCloseModal, HorizontalSeparator, Text } from '@/components';
import { Doc } from '@/docs/doc-management';
import { useResponsiveStore } from '@/stores';

const NotifyModalStyle = createGlobalStyle`
  .--docs--doc-notify-modal .c__modal__title {
    padding-bottom: 0 !important;
  }
`;

type Props = {
  doc: Doc;
  onClose: () => void;
};

type NotificationKey = 'comments' | 'mentions' | 'updates' | 'shares';

type NotificationOption = {
  key: NotificationKey;
  label: string;
  description: string;
};

type TabKey = 'activation' | 'settings';
const ToggleSwitch = ({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  ariaLabel: string;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    onClick={() => onChange(!checked)}
    style={{
      width: '40px',
      height: '22px',
      borderRadius: '999px',
      border: 'none',
      cursor: 'pointer',
      padding: '2px',
      display: 'flex',
      justifyContent: checked ? 'flex-end' : 'flex-start',
      backgroundColor: checked ? 'var(--c--theme--colors--primary-500, #000091)' : '#ccc',
      transition: 'background-color 0.15s ease',
    }}
  >
    <span
      style={{
        width: '18px',
        height: '18px',
        borderRadius: '50%',
        backgroundColor: '#fff',
        display: 'block',
      }}
    />
  </button>
);

export const DocNotifyModal = ({ doc, onClose }: Props) => {
  const { t } = useTranslation();
  const { isLargeScreen } = useResponsiveStore();
  const [activeTab, setActiveTab] = useState<TabKey>('activation');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [preferences, setPreferences] = useState<Record<NotificationKey, boolean>>({
    comments: true,
    mentions: true,
    updates: false,
    shares: true,
  });
  const notificationOptions: NotificationOption[] = [
    {
      key: 'comments',
      label: t('Comments'),
      description: t('Get notified when someone comments on this document.'),
    },
    {
      key: 'mentions',
      label: t('Mentions'),
      description: t('Get notified when someone mentions you.'),
    },
    {
      key: 'updates',
      label: t('Document updates'),
      description: t('Get notified when the document content changes.'),
    },
    {
      key: 'shares',
      label: t('Sharing'),
      description: t('Get notified when access to this document changes.'),
    },
  ];
  const tabs: { key: TabKey; label: string }[] = [
    { key: 'activation', label: t('Activation') },
    { key: 'settings', label: t('Settings') },
  ];
  const toggleNotifications = (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    announce(
      enabled
        ? t('Notifications enabled for this document.')
        : t('Notifications disabled for this document.'),
      'polite',
    );
  };
  const togglePreference = (key: NotificationKey, value: boolean) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
    announce(
      t('{{label}} notifications {{state}}.', {
        label: notificationOptions.find((opt) => opt.key === key)?.label,
        state: value ? t('enabled') : t('disabled'),
      }),
      'polite',
    );
  };
  return (
    <Modal
      isOpen
      closeOnClickOutside
      data-testid="doc-notify-modal"
      data-doc-id={doc.id}
      aria-label={t('Notification settings')}
      size={isLargeScreen ? ModalSize.LARGE : ModalSize.FULL}
      aria-modal="true"
      onClose={onClose}
      title={
        <Box $direction="row" $justify="space-between" $align="center">
          <Text
            as="h1"
            id="doc-notify-modal-title"
            $align="flex-start"
            $size="small"
            $weight="600"
            $margin="0"
          >
            {t('Notifications')}
          </Text>
          <ButtonCloseModal
            aria-label={t('Close the notification settings modal')}
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
            border-bottom: 1px solid var(--c--theme--colors--greyscale-200, #e5e5e5);
          `}
          role="tablist"
          aria-label={t('Notification settings sections')}
        >
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '12px 16px',
                fontWeight: activeTab === tab.key ? 600 : 400,
                borderBottom:
                  activeTab === tab.key
                    ? '2px solid var(--c--theme--colors--primary-500, #000091)'
                    : '2px solid transparent',
                marginBottom: '-1px',
              }}
            >
              {tab.label}
            </button>
          ))}
        </Box>
        <Box $padding={{ horizontal: 'base', vertical: 'base' }} $gap="1rem">
          {activeTab === 'activation' && (
            <Box
              $direction="row"
              $align="center"
              $justify="space-between"
              $padding={{ vertical: 'sm' }}
            >
              <Box $gap="2px">
                <Text $weight="600" $size="sm">
                  {t('Activate notifications')}
                </Text>
                <Text $variation="secondary" $size="xs">
                  {t('Receive alerts about activity on this document.')}
                </Text>
              </Box>
              <ToggleSwitch
                checked={notificationsEnabled}
                onChange={toggleNotifications}
                ariaLabel={t('Activate notifications for this document')}
              />
            </Box>
          )}
          {activeTab === 'settings' && (
            <Box $gap="0.75rem">
              {!notificationsEnabled && (
                <Text $variation="secondary" $size="sm">
                  {t('Activate notifications in the first tab to configure them.')}
                </Text>
              )}
              {notificationOptions.map((option) => (
                <Box
                  key={option.key}
                  $direction="row"
                  $align="center"
                  $justify="space-between"
                >
                  <Box $gap="2px" $maxWidth="80%">
                    <Text $size="sm">{option.label}</Text>
                    <Text $variation="secondary" $size="xs">
                      {option.description}
                    </Text>
                  </Box>
                  <ToggleSwitch
                    checked={notificationsEnabled && preferences[option.key]}
                    onChange={(value) => togglePreference(option.key, value)}
                    ariaLabel={option.label}
                  />
                </Box>
              ))}
            </Box>
          )}
          <HorizontalSeparator $margin={{ vertical: 'xs' }} />
          <Box $direction="row" $justify="flex-end">
            <Button color="primary" onClick={onClose}>
              {t('Done')}
            </Button>
          </Box>
        </Box>
      </Box>
    </Modal>
  );
};