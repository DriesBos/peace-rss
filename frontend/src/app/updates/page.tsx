import Link from 'next/link';
import styles from './page.module.sass';
import { IconArrowLeft } from '@/components/icons/IconArrowLeft';
import { IconWrapper } from '@/components/icons/IconWrapper/IconWrapper';
import { EscapeToHome } from '@/components/EscapeToHome/EscapeToHome';

const UPDATE_ITEMS = [
  {
    date: '01.02.2026',
    title: 'General Work',
    items: [
      'Working with wood, dressing a kimono. Craft and repetition are habits.',
      'This infuses daily life and gives space for pause and moments to enjoy details.',
    ],
  },
  {
    date: '01.02.2026',
    title: 'Backend',
    items: [
      'Working with wood, dressing a kimono. Craft and repetition are habits.',
      'This infuses daily life and gives space for pause and moments to enjoy details.',
    ],
  },
  {
    date: '01.02.2026',
    title: 'Menu Styling',
    items: [
      'Working with wood, dressing a kimono. Craft and repetition are habits.',
      'This infuses daily life and gives space for pause and moments to enjoy details.',
    ],
  },
  {
    date: '01.02.2026',
    title: 'General Work',
    items: [
      'Working with wood, dressing a kimono. Craft and repetition are habits.',
      'This infuses daily life and gives space for pause and moments to enjoy details.',
    ],
  },
  {
    date: '01.02.2026',
    title: 'General Work',
    items: [
      'Working with wood, dressing a kimono. Craft and repetition are habits.',
      'This infuses daily life and gives space for pause and moments to enjoy details.',
    ],
  },
  {
    date: '01.02.2026',
    title: 'General Work',
    items: [
      'Working with wood, dressing a kimono. Craft and repetition are habits.',
      'This infuses daily life and gives space for pause and moments to enjoy details.',
    ],
  },
  {
    date: '01.02.2026',
    title: 'General Work',
    items: [
      'Working with wood, dressing a kimono. Craft and repetition are habits.',
      'This infuses daily life and gives space for pause and moments to enjoy details.',
    ],
  },
];

export default function UpdatesPage() {
  return (
    <div className={styles.updatesPage}>
      <EscapeToHome />
      <div className={styles.content}>
        <Link href="/" className={styles.backButton} aria-label="Back to home">
          <IconWrapper variant="wide">
            <IconArrowLeft />
          </IconWrapper>
          <span>Back</span>
        </Link>

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
