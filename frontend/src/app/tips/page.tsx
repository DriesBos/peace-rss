import styles from './page.module.sass';
import { EscapeToHome } from '@/components/EscapeToHome/EscapeToHome';
import { BackButton } from '@/components/BackButton/BackButton';

const TIPS = [
  'Pull down — refresh feed',
  '"R" — refresh feed',
  '"+" — add content',
  '"m" — toggle an article asread/unread',
  '"esc" — close panel or modal or returns to Home.',
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
