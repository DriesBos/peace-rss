import styles from './page.module.sass';
import { EscapeToHome } from '@/components/EscapeToHome/EscapeToHome';
import { BackButton } from '@/components/BackButton/BackButton';

const UPDATE_ITEMS = [
  {
    date: '20.03.2026',
    title: 'Caching fixes and new options',
    items: [
      'Resolved issues with caching.',
      'Added type family "Newspaper"',
      'Added font sizing option',
      '"Dark" theme shows wider content on mobile, using screen border as padding',
    ],
  },
  {
    date: '01.02.2026',
    title: 'Application launch',
    items: [
      'Application launch.',
    ],
  },
];

export default function UpdatesPage() {
  return (
    <div className={styles.updatesPage}>
      <EscapeToHome />
      <div className={styles.content}>
        <BackButton />

        <div className={styles.textBlock}>
          <h2 className={styles.sectionTitle}>Update Log</h2>
          <div className={styles.updateList}>
            {UPDATE_ITEMS.map((update, index) => (
              <article
                className={styles.updateItem}
                key={`${update.title}-${index}`}
              >
                <div className={styles.updateHeader}>
                  <span className={styles.updateDate}>{update.date}</span>
                  <span className={styles.updateDash}>—</span>
                  <span className={styles.updateTitle}>{update.title}</span>
                </div>
                <ol className={styles.updatePoints}>
                  {update.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
