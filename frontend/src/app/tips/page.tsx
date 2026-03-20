import styles from './page.module.sass';
import { EscapeToHome } from '@/components/EscapeToHome/EscapeToHome';
import { BackButton } from '@/components/BackButton/BackButton';

const TIPS = [
  'Pull down — refresh feed',
  '"R" — refresh feed',
  '"+" — add content',
  '"m" — toggle an article as read/unread',
  '"f" — star or unstar the current article',
  '"d" — fetch the original source for the current article',
  '"a" — mark the current page as read',
  '"esc" — close panel or modal or returns to Home.',
  '"j / n" — next article',
  '"k / p" — previous article',
  '"← →" — prev/next article',
  'Swipe left or right on stories to navigate.',
];

export default function TipsPage() {
  return (
    <div className={styles.tipsPage}>
      <EscapeToHome />
      <div className={styles.content}>
        <BackButton />

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
