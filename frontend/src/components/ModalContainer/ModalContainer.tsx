import styles from './ModalContainer.module.sass';
import { Button } from '@/components/Button/Button';
import { useDisableScroll } from '@/hooks/useDisableScroll';

type ModalContainerProps = {
  isOpen: boolean;
  onClose: () => void;
  ariaLabel?: string;
  children: React.ReactNode;
};

export function ModalContainer({
  isOpen,
  onClose,
  ariaLabel,
  children,
}: ModalContainerProps) {
  // Disable body scroll when modal is open
  useDisableScroll(isOpen);

  return (
    <div
      className={styles.modalOverlay}
      role="presentation"
      onClick={onClose}
      aria-hidden={!isOpen}
      data-active={isOpen}
    >
      <div
        className={styles.modalOverlay_Container}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onClick={(event) => event.stopPropagation()}
        data-active={isOpen}
      >
        <div
          className={styles.modalOverlay_ClosingBar}
          onClick={onClose}
          aria-label="Close modal"
        >
          <div className={styles.modalOverlay_ClosingBar_Button} />
          {children}
        </div>
      </div>
    </div>
  );
}
