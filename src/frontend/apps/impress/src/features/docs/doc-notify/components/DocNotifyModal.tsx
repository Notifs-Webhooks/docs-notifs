import { Button, Modal, ModalSize } from '@gouvfr-lasuite/ui-components';
import { announce } from '@react-aria/live-announcer';
import { PropsWithChildren, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styled, { createGlobalStyle, css } from 'styled-components';

import { Box, ButtonCloseModal, HorizontalSeparator, Text } from '@/components';
import { Doc } from '@/docs/doc-management';
import { useResponsiveStore } from '@/stores';
import { safeLocalStorage } from '@/utils/storages';

const NotifyModalStyle = createGlobalStyle`
  .--docs--doc-notify-modal .c__modal__title {
    padding-bottom: 0 !important;
  }
`;

const CheckboxVisual = styled.span<{ $checked: boolean }>`
  align-items: center;
  background-color: ${({ $checked }) =>
    $checked ? 'var(--c--theme--colors--primary-500, #000091)' : '#fff'};
  border: 1.5px solid
    ${({ $checked }) =>
      $checked
        ? 'var(--c--theme--colors--primary-500, #000091)'
        : 'var(--c--theme--colors--greyscale-400, #929292)'};
  border-radius: 4px;
  display: inline-flex;
  flex-shrink: 0;
  height: 18px;
  justify-content: center;
  transition:
    background-color 0.1s ease,
    border-color 0.1s ease;
  width: 18px;
`;

const CheckIcon = styled.svg`
  fill: none;
  height: 11px;
  stroke: #fff;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.5;
  width: 11px;
`;

const CheckboxButton = styled.button<{ $align?: 'center' | 'flex-start' }>`
  appearance: none;
  align-items: ${({ $align }) => $align ?? 'center'};
  background: transparent;
  border: 0;
  border-radius: 4px;
  color: inherit;
  cursor: pointer;
  display: flex;
  font: inherit;
  gap: 8px;
  margin: 0 -6px;
  padding: 4px 6px;
  text-align: left;
  user-select: none;
  width: 100%;

  &:hover {
    background-color: var(--c--theme--colors--greyscale-050, #f6f6f6);
  }

  &:focus-visible ${CheckboxVisual} {
    outline: 2px solid var(--c--theme--colors--primary-500, #000091);
    outline-offset: 2px;
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

type Props = {
  doc: Doc;
  onClose: () => void;
};

type TabKey = 'activation' | 'settings';
type Frequency = 'realtime' | 'daily' | 'weekly';
type Channel = 'email' | 'app' | 'both';

type NotificationSettings = {
  enabled: boolean;
  frequency: Frequency;
  channel: Channel;
  includeDocDetails: boolean;
  includeDateTime: boolean;
  includeModificationNature: boolean;
  includeDocLink: boolean;
  includeTchapTargets: boolean;
  includeConfidentialityWarning: boolean;
};

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  frequency: 'daily',
  channel: 'email',
  includeDocDetails: true,
  includeDateTime: true,
  includeModificationNature: true,
  includeDocLink: true,
  includeTchapTargets: true,
  includeConfidentialityWarning: false,
};

const storageKey = (docId: string) => `docs-notification-settings:${docId}`;

const isFrequency = (value: unknown): value is Frequency =>
  value === 'realtime' || value === 'daily' || value === 'weekly';

const isChannel = (value: unknown): value is Channel =>
  value === 'email' || value === 'app' || value === 'both';

const readBoolean = (value: unknown, fallback: boolean) =>
  typeof value === 'boolean' ? value : fallback;

const readSettings = (docId: string): NotificationSettings => {
  const storedSettings = safeLocalStorage.getItem(storageKey(docId));
  if (!storedSettings) {
    return DEFAULT_SETTINGS;
  }

  try {
    const value = JSON.parse(storedSettings) as Record<string, unknown>;
    return {
      enabled: readBoolean(value.enabled, DEFAULT_SETTINGS.enabled),
      frequency: isFrequency(value.frequency)
        ? value.frequency
        : DEFAULT_SETTINGS.frequency,
      channel: isChannel(value.channel)
        ? value.channel
        : DEFAULT_SETTINGS.channel,
      includeDocDetails: readBoolean(
        value.includeDocDetails,
        DEFAULT_SETTINGS.includeDocDetails,
      ),
      includeDateTime: readBoolean(
        value.includeDateTime,
        DEFAULT_SETTINGS.includeDateTime,
      ),
      includeModificationNature: readBoolean(
        value.includeModificationNature,
        DEFAULT_SETTINGS.includeModificationNature,
      ),
      includeDocLink: readBoolean(
        value.includeDocLink,
        DEFAULT_SETTINGS.includeDocLink,
      ),
      includeTchapTargets: readBoolean(
        value.includeTchapTargets,
        DEFAULT_SETTINGS.includeTchapTargets,
      ),
      includeConfidentialityWarning: readBoolean(
        value.includeConfidentialityWarning,
        DEFAULT_SETTINGS.includeConfidentialityWarning,
      ),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

const CheckboxRow = ({
  checked,
  onChange,
  align,
  children,
}: PropsWithChildren<{
  checked: boolean;
  onChange: (value: boolean) => void;
  align?: 'center' | 'flex-start';
}>) => (
  <CheckboxButton
    type="button"
    role="checkbox"
    aria-checked={checked}
    $align={align}
    onClick={() => onChange(!checked)}
  >
    <CheckboxVisual $checked={checked} aria-hidden="true">
      {checked && (
        <CheckIcon viewBox="0 0 12 12">
          <polyline points="1.5 6.5 4.5 9.5 10.5 2.5" />
        </CheckIcon>
      )}
    </CheckboxVisual>
    {children}
  </CheckboxButton>
);

const Switch = ({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) => (
  <SwitchButton
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
  >
    <SwitchTrack $checked={checked} aria-hidden="true">
      <SwitchThumb $checked={checked} />
    </SwitchTrack>
  </SwitchButton>
);

export const DocNotifyModal = ({ doc, onClose }: Props) => {
  const { t } = useTranslation();
  const { isLargeScreen } = useResponsiveStore();
  const [activeTab, setActiveTab] = useState<TabKey>('activation');
  const [settings, setSettings] = useState<NotificationSettings>(() =>
    readSettings(doc.id),
  );

  const updateSetting = <Key extends keyof NotificationSettings>(
    key: Key,
    value: NotificationSettings[Key],
  ) => {
    setSettings((currentSettings) => ({
      ...currentSettings,
      [key]: value,
    }));
  };

  const toggleNotifications = (enabled: boolean) => {
    updateSetting('enabled', enabled);
    announce(
      enabled
        ? t('Enabled notifications for this document.')
        : t('Notifications disabled for this document.'),
      'polite',
    );
  };

  const saveAndClose = () => {
    safeLocalStorage.setItem(storageKey(doc.id), JSON.stringify(settings));
    announce(t('Notification preferences saved locally.'), 'polite');
    onClose();
  };

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
            border-bottom: 1px solid
              var(--c--theme--colors--greyscale-200, #e5e5e5);
          `}
          role="tablist"
          aria-label={t('Notification settings tabs')}
        >
          {tabs.map((tab) => (
            <TabButton
              key={tab.key}
              id={`doc-notify-${tab.key}-tab`}
              type="button"
              role="tab"
              aria-controls={`doc-notify-${tab.key}-panel`}
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
            <Box
              id="doc-notify-activation-panel"
              role="tabpanel"
              aria-labelledby="doc-notify-activation-tab"
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
                  {t('Receive notifications for activity on this document.')}
                </Text>
              </Box>
              <Switch
                checked={settings.enabled}
                onChange={toggleNotifications}
                label={t('Enable notifications for this document')}
              />
            </Box>
          )}

          {activeTab === 'settings' && (
            <Box
              id="doc-notify-settings-panel"
              role="tabpanel"
              aria-labelledby="doc-notify-settings-tab"
              $gap="1.25rem"
            >
              {!settings.enabled ? (
                <Text $variation="secondary" $size="sm">
                  {t(
                    'Notifications are currently disabled. Enable them in the Notifications tab to access settings.',
                  )}
                </Text>
              ) : (
                <>
                  <Box $gap="0.25rem">
                    <Text
                      $weight="600"
                      $size="xs"
                      $textTransform="uppercase"
                      $variation="secondary"
                    >
                      {t('Notification content')}
                    </Text>
                    <CheckboxRow
                      checked={settings.includeDocDetails}
                      onChange={(checked) =>
                        updateSetting('includeDocDetails', checked)
                      }
                    >
                      <Text $size="sm">{t('ID and document name')}</Text>
                    </CheckboxRow>
                    <CheckboxRow
                      checked={settings.includeDateTime}
                      onChange={(checked) =>
                        updateSetting('includeDateTime', checked)
                      }
                    >
                      <Text $size="sm">{t('Date and time')}</Text>
                    </CheckboxRow>
                    <CheckboxRow
                      checked={settings.includeModificationNature}
                      onChange={(checked) =>
                        updateSetting('includeModificationNature', checked)
                      }
                    >
                      <Text $size="sm">{t('Nature of modification')}</Text>
                    </CheckboxRow>
                    <CheckboxRow
                      checked={settings.includeDocLink}
                      onChange={(checked) =>
                        updateSetting('includeDocLink', checked)
                      }
                    >
                      <Text $size="sm">{t('Link to document')}</Text>
                    </CheckboxRow>
                    <CheckboxRow
                      checked={settings.includeTchapTargets}
                      onChange={(checked) =>
                        updateSetting('includeTchapTargets', checked)
                      }
                      align="flex-start"
                    >
                      <Box $gap="2px">
                        <Text $size="sm">
                          {t(
                            'Specific recipient Tchap contacts and/or channels',
                          )}
                        </Text>
                        <Text $variation="secondary" $size="xs">
                          {t(
                            'Limited to people who can access the document. The default destination is the Notifier conversation.',
                          )}
                        </Text>
                      </Box>
                    </CheckboxRow>
                    <CheckboxRow
                      checked={settings.includeConfidentialityWarning}
                      onChange={(checked) =>
                        updateSetting('includeConfidentialityWarning', checked)
                      }
                      align="flex-start"
                    >
                      <Text $size="sm">
                        {t('Include a confidentiality warning for webhooks')}
                      </Text>
                    </CheckboxRow>
                  </Box>

                  <Box $gap="0.35rem">
                    <label htmlFor="doc-notify-frequency">
                      <Text $size="sm" $weight="600">
                        {t('Frequency')}
                      </Text>
                    </label>
                    <Select
                      id="doc-notify-frequency"
                      value={settings.frequency}
                      onChange={(event) =>
                        updateSetting(
                          'frequency',
                          event.target.value as Frequency,
                        )
                      }
                    >
                      <option value="realtime">{t('Instantaneous')}</option>
                      <option value="daily">{t('Daily summary')}</option>
                      <option value="weekly">{t('Weekly summary')}</option>
                    </Select>
                  </Box>

                  <Box $gap="0.35rem">
                    <label htmlFor="doc-notify-channel">
                      <Text $size="sm" $weight="600">
                        {t('Notification channel')}
                      </Text>
                    </label>
                    <Select
                      id="doc-notify-channel"
                      value={settings.channel}
                      onChange={(event) =>
                        updateSetting('channel', event.target.value as Channel)
                      }
                    >
                      <option value="email">{t('Email only')}</option>
                      <option value="app">{t('Tchap only')}</option>
                      <option value="both">{t('Email and Tchap')}</option>
                    </Select>
                  </Box>
                </>
              )}
            </Box>
          )}

          <HorizontalSeparator $margin={{ vertical: 'xs' }} />
          <Box $direction="row" $justify="flex-end" $gap="0.5rem">
            <Button color="brand" onClick={saveAndClose}>
              {t('Done')}
            </Button>
          </Box>
        </Box>
      </Box>
    </Modal>
  );
};
