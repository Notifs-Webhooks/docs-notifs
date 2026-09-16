import { Button, Modal, ModalSize } from '@gouvfr-lasuite/ui-components';
import { announce } from '@react-aria/live-announcer';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styled, { createGlobalStyle, css } from 'styled-components';

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

const HiddenInput = styled.input`
  border: 0;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  height: 1px;
  margin: -1px;
  overflow: hidden;
  padding: 0;
  position: absolute;
  white-space: nowrap;
  width: 1px;
`;

const CheckboxVisual = styled.span<{ $checked: boolean }>`
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 1.5px solid
    ${({ $checked }) =>
      $checked
        ? 'var(--c--theme--colors--primary-500, #000091)'
        : 'var(--c--theme--colors--greyscale-400, #929292)'};
  background-color: ${({ $checked }) =>
    $checked ? 'var(--c--theme--colors--primary-500, #000091)' : '#fff'};
  display: inline-grid;
  place-content: center;
  flex-shrink: 0;
  transition: background-color 0.1s ease, border-color 0.1s ease;
`;

const CheckIcon = styled.svg`
  width: 11px;
  height: 11px;
  fill: none;
  stroke: #fff;
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
`;

const CheckboxRowLabel = styled.label<{ $align?: 'center' | 'flex-start' }>`
  display: flex;
  align-items: ${({ $align }) => $align ?? 'center'};
  gap: 8px;
  width: 100%;
  text-align: left;
  cursor: pointer;
  padding: 4px 6px;
  margin: 0 -6px;
  border-radius: 4px;
  user-select: none;

  &:hover {
    background-color: var(--c--theme--colors--greyscale-050, #f6f6f6);
  }

  &:focus-within ${CheckboxVisual} {
    outline: 2px solid var(--c--theme--colors--primary-500, #000091);
    outline-offset: 2px;
  }
`;

const CheckboxRow = ({
  checked,
  onChange,
  align,
  children,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  align?: 'center' | 'flex-start';
  children: React.ReactNode;
  ariaLabel?: string;
}) => (
  <CheckboxRowLabel $align={align}>
    <HiddenInput
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      aria-label={ariaLabel}
    />
    <CheckboxVisual $checked={checked}>
      {checked && (
        <CheckIcon viewBox="0 0 12 12">
          <polyline points="1.5 6.5 4.5 9.5 10.5 2.5" />
        </CheckIcon>
      )}
    </CheckboxVisual>
    {children}
  </CheckboxRowLabel>
);

// Visuel du Switch / Interrupteur
const SwitchLabel = styled.label`
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
`;

const SwitchTrack = styled.span<{ $checked: boolean }>`
  position: relative;
  width: 40px;
  height: 22px;
  border-radius: 999px;
  background-color: ${({ $checked }) =>
    $checked ? 'var(--c--theme--colors--primary-500, #000091)' : '#ccc'};
  transition: background-color 0.15s ease;
  flex-shrink: 0;
  display: inline-block;

  &:focus-within {
    outline: 2px solid var(--c--theme--colors--primary-500, #000091);
    outline-offset: 2px;
  }
`;

const SwitchThumb = styled.span<{ $checked: boolean }>`
  position: absolute;
  top: 2px;
  left: ${({ $checked }) => ($checked ? '20px' : '2px')};
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background-color: #fff;
  transition: left 0.15s ease;
`;

const Switch = ({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  ariaLabel: string;
}) => (
  <SwitchLabel>
    <HiddenInput
      type="checkbox"
      role="switch"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      aria-label={ariaLabel}
    />
    <SwitchTrack $checked={checked}>
      <SwitchThumb $checked={checked} />
    </SwitchTrack>
  </SwitchLabel>
);

export const DocNotifyModal = ({ doc, onClose }: Props) => {
  const { t } = useTranslation();
  const { isLargeScreen } = useResponsiveStore();
  const [activeTab, setActiveTab] = useState<TabKey>('activation');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [frequency, setFrequency] = useState<Frequency>('daily');
  const [channel, setChannel] = useState<Channel>('email');
  const [includeDocDetails, setIncludeDocDetails] = useState(true);
  const [includeDateTime, setIncludeDateTime] = useState(true);
  const [includeModificationNature, setIncludeModificationNature] = useState(true);
  const [includeDocLink, setIncludeDocLink] = useState(true);
  const [includeTchapTargets, setIncludeTchapTargets] = useState(true);
  const [includeConfidentialityWarning, setIncludeConfidentialityWarning] = useState(false);

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
          aria-label={t('Notification settings tabs')}
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
              <Switch
                checked={notificationsEnabled}
                onChange={toggleNotifications}
                ariaLabel={t('Enabled notifications for this document')}
              />
            </Box>
          )}
          {activeTab === 'settings' && (
            <Box $gap="1.25rem">
              {!notificationsEnabled ? (
                <Text $variation="secondary" $size="sm">
                  {t(
                    'Notifications are currently disabled. Please enable them in the "Activation" tab to access settings.',
                  )}
                </Text>
              ) : (
                <>
                  <Box $gap="0.25rem">
                    <Text $weight="600" $size="xs" $transform="uppercase" $variation="secondary">
                      {t('Notification content')}
                    </Text>
                    <CheckboxRow checked={includeDocDetails} onChange={setIncludeDocDetails}>
                      <Text $size="sm">{t('ID and document name')}</Text>
                    </CheckboxRow>
                    <CheckboxRow checked={includeDateTime} onChange={setIncludeDateTime}>
                      <Text $size="sm">{t('Date and time')}</Text>
                    </CheckboxRow>
                    <CheckboxRow
                      checked={includeModificationNature}
                      onChange={setIncludeModificationNature}
                    >
                      <Text $size="sm">{t('Nature of modification')}</Text>
                    </CheckboxRow>
                    <CheckboxRow checked={includeDocLink} onChange={setIncludeDocLink}>
                      <Text $size="sm">{t('Link to document')}</Text>
                    </CheckboxRow>
                    <CheckboxRow
                      checked={includeTchapTargets}
                      onChange={setIncludeTchapTargets}
                      align="flex-start"
                    >
                      <Box $gap="2px">
                        <Text $size="sm">
                          {t('Specific recipient Tchap contacts and/or channels')}
                        </Text>
                        <Text $variation="secondary" $size="xs">
                          {t(
                            '(TBC limited only to users with viewer permissions at minimum) - default = Tchap bot/notification channel',
                          )}
                        </Text>
                      </Box>
                    </CheckboxRow>
                    <CheckboxRow
                      checked={includeConfidentialityWarning}
                      onChange={setIncludeConfidentialityWarning}
                      align="flex-start"
                    >
                      <Text $size="sm">
                        {t('For webhooks: specific warnings regarding confidentiality')}
                      </Text>
                    </CheckboxRow>
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