import { Modal, ModalSize } from '@gouvfr-lasuite/ui-components';
import { announce } from '@react-aria/live-announcer';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createGlobalStyle, css } from 'styled-components';
import { useDebouncedCallback } from 'use-debounce';

import { Box, ButtonCloseModal, HorizontalSeparator, Text } from '@/components';
import { useConfig } from '@/core';
import { Doc } from '@/docs/doc-management';
import { User } from '@/features/auth';
import { useResponsiveStore } from '@/stores';
import { isValidEmail } from '@/utils';

import {
  KEY_LIST_DOC_ACCESSES,
  KEY_LIST_DOC_ACCESS_REQUESTS,
  KEY_LIST_DOC_INVITATIONS,
  KEY_LIST_USER,
  useDocAccesses,
  useUsers,
} from '../api';

const ShareModalStyle = createGlobalStyle`
  .--docs--doc-notif-modal [cmdk-item] {
    cursor: auto;
  }
  .c__modal__title {
    padding-bottom: 0 !important;
  }
`;

type Props = {
  doc: Doc;
  isRootDoc?: boolean;
  onClose: () => void;
};

export const DocNotifyModal = ({ doc, onClose, isRootDoc = true }: Props) => {
  const { t } = useTranslation();
  const selectedUsersRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { data: config } = useConfig();
  const API_USERS_SEARCH_QUERY_MIN_LENGTH =
    config?.API_USERS_SEARCH_QUERY_MIN_LENGTH || 5;

  const { isLargeScreen } = useResponsiveStore();

  /**
   * The modal content height is calculated based on the viewport height.
   * The formula is:
   * 100dvh - 2em - 12px - 34px
   * - 34px is the height of the modal title in mobile
   * - 2em is the padding of the modal content
   * - 12px is the padding of the modal footer
   * - 690px is the height of the content in desktop
   * This ensures that the modal content is always visible and does not overflow.
   */
  const modalContentHeight = isLargeScreen
    ? 'min(690px, calc(100dvh - 2em - 12px - 34px))'
    : `calc(100dvh - 34px)`;

  const [listHeight, setListHeight] = useState<string>('400px');
  const canShare = doc.abilities.accesses_manage && isRootDoc;
  const canViewAccesses = doc.abilities.accesses_view;

  //   const userName = user.full_name || user.email;
  //   announce(
  //     t(
  //       '{{name}} added to invite list. Add more members or press Tab to select role and invite.',
  //       {
  //         name: userName,
  //       },
  //     ),
  //     'polite',
  //   );
  // };

  return (
    <>
      <Modal
        isOpen
        closeOnClickOutside
        data-testid="doc-notify-modal"
        aria-label={t('Notify changes in the document')}
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
              {t('Notify changes in the document')}
            </Text>
            <ButtonCloseModal
              aria-label={t('Close the notify modal')}
              onClick={onClose}
            />
          </Box>
        }
        hideCloseButton
      >
        <NotifyModalStyle />
        <Box
          $height="auto"
          $maxHeight={canViewAccesses ? modalContentHeight : 'none'}
          $overflow="hidden"
          className="--docs--doc-notify-modal noPadding "
          $justify="space-between"
        >
          <Box
            $flex={1}
            $css={css`
              [cmdk-list] {
                overflow-y: auto;
                height: ${listHeight};
              }
            `}
          >
            <Box data-testid="doc-notify-quick-search">
            </Box>
          </Box>

          <Box ref={handleRef}>
            {showFooter && <DocShareModalFooter doc={doc} onClose={onClose} />}
          </Box>
        </Box>
      </Modal>
    </>
  );
};