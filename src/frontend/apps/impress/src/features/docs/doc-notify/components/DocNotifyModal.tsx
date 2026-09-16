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

type TabKey = 'activation' | 'settings';
type Frequency = 'realtime' | 'daily' | 'weekly';
type Channel = 'email' | 'app' | 'both';
  
export const DocNotifyModal = ({ doc, onClose }: Props) => {
  const { t } = useTranslation();
  const { isLargeScreen } = useResponsiveStore();
  const [activeTab, setActiveTab] = useState<TabKey>('activation');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const [frequency, setFrequency] = useState<Frequency>('daily');
  const [channel, setChannel] = useState<Channel>('email');
  const [notifyComments, setNotifyComments] = useState(true);
  const [notifyEdits, setNotifyEdits] = useState(false);

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'activation', label: t('Notifications') },
    { key: 'settings', label: t('Settings') },
  ];

  const toggleNotifications = (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    announce(
      enabled
        ? t('Enabled notifications for this document.')
        : t('Notifications disabled for this document.'),
      'polite',
    );
  };

  return (
    <Modal
      isOpen
      closeOnClickOutside
      data-testid="doc-notify-modal"
      data-doc-id={doc.id}
      aria-label={t('Notifications settings for document {{docTitle}}', { docTitle: doc.title })}
      size={isLargeScreen ? ModalSize.MEDIUM : ModalSize.FULL}
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
            border-bottom: 1px solid var(--c--theme--colors--greyscale-200, #e5e5e5);
          `}
          role="tablist"
          aria-label={t('Notification settings tab')}
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

        <Box $padding={{ horizontal: 'base', vertical: 'base' }} $gap="1.25rem">
          {activeTab === 'activation' && (
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
                  {t('Recieve notifications for activity on this document.')}
                </Text>
              </Box>
              
              <input
                type="checkbox"
                role="switch"
                checked={notificationsEnabled}
                onChange={(e) => toggleNotifications(e.target.checked)}
                aria-label={t('Enabled notifications for this document')}
              />
            </Box>
          )}

          {activeTab === 'settings' && (
            <Box $gap="1.25rem">
              {!notificationsEnabled ? (
                <Text $variation="secondary" $size="sm">
                  {t('Notifications are currently disabled. Please enable them in the "Activation" tab to access settings.')}
                </Text>
              ) : (
                <>
                  <Box $gap="0.5rem">
                    <Text $weight="600" $size="xs" $transform="uppercase" $variation="secondary">
                      {t('Notification content')}
                    </Text>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={notifyComments}
                        onChange={(e) => setNotifyComments(e.target.checked)}
                      />
                      <Text $size="sm">{t('Comments and replies')}</Text>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={notifyEdits}
                        onChange={(e) => setNotifyEdits(e.target.checked)}
                      />
                      <Text $size="sm">{t('Content modifications')}</Text>
                    </label>
                  </Box>
                  <Box $gap="0.35rem">
                    <Text as="label" htmlFor="doc-notify-frequency" $size="sm" $weight="600">
                      {t('Frequency')}
                    </Text>
                    <select
                      id="doc-notify-frequency"
                      value={frequency}
                      onChange={(e) => setFrequency(e.target.value as Frequency)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '4px',
                        border: '1px solid var(--c--theme--colors--greyscale-300, #e5e5e5)',
                        backgroundColor: '#fff',
                        fontSize: '14px',
                        width: '100%',
                      }}
                    >
                      <option value="realtime">{t('Instantaneous')}</option>
                      <option value="daily">{t('Daily summary')}</option>
                      <option value="weekly">{t('Weekly summary')}</option>
                    </select>
                  </Box>
                  <Box $gap="0.35rem">
                    <Text as="label" htmlFor="doc-notify-channel" $size="sm" $weight="600">
                      {t('Notification channel')}
                    </Text>
                    <select
                      id="doc-notify-channel"
                      value={channel}
                      onChange={(e) => setChannel(e.target.value as Channel)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '4px',
                        border: '1px solid var(--c--theme--colors--greyscale-300, #e5e5e5)',
                        backgroundColor: '#fff',
                        fontSize: '14px',
                        width: '100%',
                      }}
                    >
                      <option value="email">{t('Mail only')}</option>
                      <option value="app">{t('Tchap only')}</option>
                      <option value="both">{t('E-mail and Tchap')}</option>
                    </select>
                  </Box>
                </>
              )}
            </Box>
          )}

          <HorizontalSeparator $margin={{ vertical: 'xs' }} />
          
          <Box $direction="row" $justify="flex-end" $gap="0.5rem">
            <Button color="primary" onClick={onClose}>
              {t('Done')}
            </Button>
          </Box>
        </Box>
      </Box>
    </Modal>
  );
};