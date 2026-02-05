import Link from 'next/link';
import styles from './page.module.sass';
import { IconArrowLeft } from '@/components/icons/IconArrowLeft';
import { IconWrapper } from '@/components/icons/IconWrapper/IconWrapper';
import { EscapeToHome } from '@/components/EscapeToHome/EscapeToHome';

const TIPS = [
  'Pull down at the top of the page to refresh your feeds.',
  'Press R to refresh your feed.',
  'Press J to move to the next entry.',
  'Press K to move to the previous entry.',
  'Press ArrowDown to move to the next entry.',
  'Press ArrowUp to move to the previous entry.',
  'When an entry is open, press ArrowRight for next and ArrowLeft for previous.',
  'Press Escape to close any open panel or modal. On info pages, Escape returns to Home.',
  'Swipe left or right on stories to navigate.',
  'Use the menu to jump between categories and starred entries.',
];

export default function TipsPage() {
  return (
    <div className={styles.tipsPage}>
      <EscapeToHome />
      <div className={styles.content}>
        <Link href="/" className={styles.backButton} aria-label="Back to home">
          <IconWrapper variant="wide">
            <IconArrowLeft />
          </IconWrapper>
          <span>Back</span>
        </Link>

        <div className={styles.textBlock}>
          <h2 className={styles.sectionTitle}>Tips</h2>
          <ol className={styles.tipsList}>
            {TIPS.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
