import { DevShell, DevSection } from '../_components/DevShell';
import styles from '../dev.module.sass';

export const metadata = { title: 'Type system · Dev' };

// Snapshot of styles/vars.sass mixins and styles/cssVars.sass type tokens.
// Samples render with the real mixins, so they follow the Type size and
// Font family settings in the menu.
const TYPE_STYLES = [
  {
    mixin: 'font-title',
    token: '--type-title',
    size: '20px / 22px',
    lineHeight: '1.45',
    letterSpacing: 'normal',
    usedIn: 'EntryPanel; also h1/h2 in globals.sass and page section titles',
    className: styles.sample_title,
    sample: 'The pattern of sunlight filtering through the leaves',
  },
  {
    mixin: 'font-body',
    token: '--type-body',
    size: '16px / 18px',
    lineHeight: '1.54',
    letterSpacing: '0.02em',
    usedIn:
      'AddModal, EntryList, EntryPanel, LabeledInput, LabeledSelect, MenuModal, app page; p/span default in globals.sass',
    className: styles.sample_body,
    sample:
      'Reading should give energy. In the right space, reading becomes a joyful habit.',
  },
  {
    mixin: 'font-nav',
    token: '--type-nav',
    size: '16px / 18px',
    lineHeight: '1.25',
    letterSpacing: 'normal',
    usedIn: 'BackButton, Button (nav), Footer, MenuModal, TheHeader',
    className: styles.sample_nav,
    sample: 'Organise  Settings  Info',
  },
  {
    mixin: 'font-button',
    token: '--type-button',
    size: '16px / 18px',
    lineHeight: '1.25',
    letterSpacing: 'normal',
    usedIn: 'Button (primary)',
    className: styles.sample_button,
    sample: 'Add feed',
  },
  {
    mixin: 'font-caption',
    token: '--type-caption',
    size: '14px / 16px',
    lineHeight: '1.45',
    letterSpacing: 'normal',
    usedIn: 'app page',
    className: styles.sample_caption,
    sample: 'Caption text under an image',
  },
  {
    mixin: 'font-meta',
    token: '--type-meta',
    size: '14px / 16px',
    lineHeight: '1.25',
    letterSpacing: 'normal',
    usedIn: 'EntryItem, EntryPanel, app page',
    className: styles.sample_meta,
    sample: '12.11.26 — By: The Guardian',
  },
  {
    mixin: 'font-summary',
    token: '--type-summary',
    size: '14px / 16px',
    lineHeight: '1.25',
    letterSpacing: 'normal',
    usedIn: 'EntryItem (preview)',
    className: styles.sample_summary,
    sample: 'A short preview of the article, cut after a few lines.',
  },
  {
    mixin: 'font-count',
    token: '--type-count',
    size: '10px / 11px',
    lineHeight: '1',
    letterSpacing: 'normal',
    usedIn: 'Button (count), LabelWithCount',
    className: styles.sample_count,
    sample: '128',
  },
];

const OTHER_TOKENS = [
  { token: '--type-data', size: '14px / 16px', note: 'Defined, used once' },
  { token: '--type-input', size: '16px / 18px', note: 'Form inputs' },
];

const FAMILIES = [
  {
    name: 'Untitled Sans',
    token: '--font-untitled-sans',
    role: 'Body and display in the Sans setting (400, 400 italic, 700, 700 italic)',
    family: 'var(--font-untitled-sans), Helvetica, sans-serif',
    weight: 400,
  },
  {
    name: 'Imperial',
    token: '--font-imperial',
    role: 'Body in the Serif setting (400)',
    family: "var(--font-imperial), Georgia, 'Times New Roman', serif",
    weight: 400,
  },
  {
    name: 'Cheltenham',
    token: '--font-cheltenham',
    role: 'Display (h1, h2) in the Serif setting (700)',
    family: "var(--font-cheltenham), Georgia, 'Times New Roman', serif",
    weight: 700,
  },
  {
    name: 'Soul Sister',
    token: '--font-soul-sister',
    role: 'LandingPage wordmark only',
    family: 'var(--font-soul-sister), serif',
    weight: 400,
  },
];

const ONE_OFFS = [
  'LandingPage: font-size 3.5rem / 15vw / 16px, letter-spacing -0.02em',
  'AddModal, EditModal: font-size 13px',
  'app page.module.sass: font-size 13px and 14px, letter-spacing 0.24em and 0.18em',
  'TheHeader: line-height 1',
  'EntryPanel article content: line-height 1.1 !important on headings',
  'about, updates, tips, notifications: section titles at --type-title, weight 400',
];

export default function TypeSystemPage() {
  return (
    <DevShell
      current="/dev/type"
      intro="Every typography style in the app today, from styles/vars.sass and styles/cssVars.sass. Sizes read default / larger type size."
    >
      <DevSection
        title="Type styles"
        note="Sass mixins. Each sample uses the real mixin."
      >
        <div className={styles.rows}>
          {TYPE_STYLES.map((style) => (
            <div key={style.mixin} className={styles.row}>
              <div className={styles.rowMeta}>
                <span>@include {style.mixin}</span>
                <span className={styles.code}>
                  {style.token} · {style.size}
                </span>
                <span className={styles.code}>
                  line-height {style.lineHeight} · tracking{' '}
                  {style.letterSpacing}
                </span>
                <span className={styles.muted}>{style.usedIn}</span>
              </div>
              <div className={`${style.className} ${styles.sampleText}`}>
                {style.sample}
              </div>
            </div>
          ))}
        </div>
      </DevSection>

      <DevSection title="Other type tokens" note="Sizes without a mixin.">
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Token</th>
                <th>Size</th>
                <th>Use</th>
              </tr>
            </thead>
            <tbody>
              {OTHER_TOKENS.map((token) => (
                <tr key={token.token}>
                  <td className={styles.code}>{token.token}</td>
                  <td>{token.size}</td>
                  <td>{token.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DevSection>

      <DevSection
        title="Font families"
        note="Loaded with next/font/local in app/layout.tsx. The menu's Font setting swaps --type-family and --type-family-display."
      >
        <div className={styles.rows}>
          {FAMILIES.map((family) => (
            <div key={family.token} className={styles.row}>
              <div className={styles.rowMeta}>
                <span>{family.name}</span>
                <span className={styles.code}>{family.token}</span>
                <span className={styles.muted}>{family.role}</span>
              </div>
              <div
                className={styles.sampleText}
                style={{
                  fontFamily: family.family,
                  fontWeight: family.weight,
                  fontSize: 28,
                  lineHeight: 1.2,
                }}
              >
                Komorebi 木漏れ日 Aa Bb 0123
              </div>
            </div>
          ))}
        </div>
      </DevSection>

      <DevSection
        title="One-off values"
        note="Hardcoded type values outside the mixins. Candidates to fold into tokens."
      >
        <ul className={styles.rows}>
          {ONE_OFFS.map((item) => (
            <li key={item} className={styles.code}>
              {item}
            </li>
          ))}
        </ul>
      </DevSection>
    </DevShell>
  );
}
