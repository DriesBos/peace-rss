import styles from './ModalContainer.module.sass';
import { Button } from '@/components/Button/Button';

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
  return (
    <div
      className={styles.modal_Overlay}
      role="presentation"
      onClick={onClose}
      aria-hidden={!isOpen}
      data-active={isOpen}
    >
      <div
        className={styles.modal_Container}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onClick={(event) => event.stopPropagation()}
        data-active={isOpen}
      >
        <div className={styles.modal_Header}>
          <Button type="button" onClick={onClose} aria-label="Close menu modal">
            Close
          </Button>
        </div>
        {children}
      </div>
      var
    </div>
  );
}
