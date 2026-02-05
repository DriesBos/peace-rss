import Link from 'next/link';
import styles from './page.module.sass';
import { IconArrowLeft } from '@/components/icons/IconArrowLeft';
import { IconWrapper } from '@/components/icons/IconWrapper/IconWrapper';
import { EscapeToHome } from '@/components/EscapeToHome/EscapeToHome';

const VALUES = [
  'Take (back) control of your news feed — We pull news from sites that abuse attention and reformat it.',
  'Reading should give energy — Most news feed apps operate like productivity centred tools. As a result they feel like work. In daily life however, we treat books, papers and magazines differently: with a nice chair, good music, cafe murmur, warm drink, paper smell and an easy window view. In the right space, reading becomes a joyful habit.',
  'Learn from Japanese Culture — In Japanese practices quality is sacrificed less for price and speed. Instead of on the wall art is infused in daily life. Drinking tea, taking care of gardens, working with wood, dressing a kimono. Craft and repetition are habits. This infuses daily life and gives space for pause and moments to enjoy details.',
];

export default function AboutPage() {
  return (
    <div className={styles.aboutPage}>
      <EscapeToHome />
      <div className={styles.content}>
        <Link href="/" className={styles.backButton} aria-label="Back to home">
          <IconWrapper variant="wide">
            <IconArrowLeft />
          </IconWrapper>
          <span>Back</span>
        </Link>

        <div className={styles.textBlock}>
          <p className={styles.lead}>
            <i>ko-mo-re-bi </i>
            (木漏れ日) — Japanese — meaning the pattern of sunlight filtering
            through the leaves of trees, creating dappled patterns on an
            surface. The word evokes tranquility and captures both the physical
            place and gentle moments.
          </p>
          <h2 className={styles.sectionTitle}>Our Values</h2>
          <ol className={styles.valuesList}>
            {VALUES.map((value) => (
              <li key={value}>{value}</li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
