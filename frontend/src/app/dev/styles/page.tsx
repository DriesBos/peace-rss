import { DevShell, DevSection } from '../_components/DevShell';
import styles from '../dev.module.sass';

export const metadata = { title: 'Style system · Dev' };

// Snapshot of styles/cssVars.sass and styles/vars.sass.

const THEMES = {
  light: {
    '--color-app': 'hsla(0, 0%, 100%, 1)',
    '--color-app-secondary': 'hsla(0, 0%, 96%, 1)',
    '--color-text': 'hsla(0, 0%, 15%, 1)',
    '--color-text-secondary': 'hsla(0, 0%, 15%, 0.5)',
    '--color-text-inactive': 'hsla(0, 0%, 15%, 0.3)',
  },
  dark: {
    '--color-app': 'hsla(0, 0%, 0%, 1)',
    '--color-app-secondary': 'hsla(0, 0%, 4%, 1)',
    '--color-text': 'hsla(0, 0%, 85%, 1)',
    '--color-text-secondary': 'hsla(0, 0%, 85%, 0.5)',
    '--color-text-inactive': 'hsla(0, 0%, 85%, 0.3)',
  },
  night: {
    '--color-app': 'hsla(0, 0%, 0%, 1)',
    '--color-app-secondary': 'hsla(0, 100%, 46%, 0.1)',
    '--color-text': 'hsla(0, 100%, 46%, 1)',
    '--color-text-secondary': 'hsla(0, 100%, 46%, 0.5)',
    '--color-text-inactive': 'hsla(0, 100%, 46%, 0.3)',
  },
} as const;

const LIVE_COLORS = [
  '--color-app',
  '--color-app-secondary',
  '--color-text',
  '--color-text-secondary',
  '--color-text-inactive',
  '--color-modal-bg',
  '--color-white',
  '--color-black',
];

const UNDEFINED_TOKENS = [
  { token: '--color-text-inverted', usedIn: 'IconWrapper' },
  { token: '--color-bg-secondary', usedIn: 'EntryItem' },
  { token: '--color-border (fallback #e6e6e6)', usedIn: 'app page' },
  { token: '--color-text-primary (fallback #000)', usedIn: 'app page' },
  { token: '--hover-opacity', usedIn: 'app page' },
];

const SPACING_SCALE = [
  ['--quarter-rem', '4px'],
  ['--half-rem', '8px'],
  ['--one-rem', '16px'],
  ['--one-half-rem', '24px'],
  ['--two-rem', '32px'],
  ['--three-rem', '48px'],
  ['--four-rem', '64px'],
  ['--eight-rem', '128px'],
];

const SPACING_LAYOUT = [
  ['--space-sides-general', '8px, 16px from 745px'],
  ['--space-sides-general-wide', '8px, 2px with Wide spacing (portrait)'],
  ['--space-sides-stories', '16px, 32px from 745px'],
  ['--space-sides-stories-wide', '16px, 8px with Wide spacing (portrait)'],
  ['--space-content-top', '128px'],
  ['--space-content-bottom', '64px'],
  ['--space-headcontent-gap', '64px'],
  ['--space-caption-gap', '6px'],
  ['--space-titlemeta-gap', '4px'],
  ['--space-sides-modal', '16px, 2px with Wide spacing (portrait)'],
  ['--space-top-modal', '48px'],
  ['--space-bottom-modal', '48px'],
  ['--space-buttons-gap', '8px'],
  ['--space-icons-gap', '8px'],
];

const BORDERS = [
  ['--border-radius-image', '0'],
  ['--border-radius-containers', '4px'],
  ['--border-radius-buttons', '4px'],
  ['--border-buttons', '1px solid var(--color-text)'],
  ['--border-buttons-inactive', '1px solid var(--color-text-secondary)'],
  ['--border-containers', '1px solid var(--color-text)'],
  ['--border-header', '1px solid color-mix(--color-text 10%)'],
];

const MISC = [
  ['--padding-buttons', '8px 16px'],
  ['--disabled-opacity', '0.33'],
  ['--icon-size', '16px (18px larger)'],
  ['--icon-size-small', '12px (14px larger)'],
  ['--icon-size-wide', '32px (36px larger)'],
  ['--transition-general', '0.33s ease'],
  ['--transition-theme', '0.33s ease'],
  ['--transition-buttons', '0.25s ease'],
  ['--transition-modal', '0.33s ease-in'],
  ['--transition-header-toggle', '0.33s ease-in'],
  ['--transition-header-border', '0.165s ease'],
  ['--index-komorebi', '0'],
  ['--index-newsfeed', '100'],
  ['--index-slidepanel', '500'],
  ['--index-modal', '600'],
  ['--index-menu', '700'],
  ['$res-tabled (Sass)', '745px, the only breakpoint'],
];

function TokenTable({ rows }: { rows: string[][] }) {
  return (
    <div className={styles.tableScroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Token</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([token, value]) => (
            <tr key={token}>
              <td className={styles.code}>{token}</td>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function StyleSystemPage() {
  return (
    <DevShell
      current="/dev/styles"
      intro="Colors, spacing, borders, motion and layers, from styles/cssVars.sass. Themes are set on :root with data-theme."
    >
      <DevSection
        title="Colors in the current theme"
        note="Live values. Switch theme in Settings to compare."
      >
        <div className={styles.swatchGrid}>
          {LIVE_COLORS.map((token) => (
            <div key={token} className={styles.swatch}>
              <div
                className={styles.swatchChip}
                style={{ background: `var(${token})` }}
              />
              <span className={styles.code}>{token}</span>
            </div>
          ))}
        </div>
      </DevSection>

      <DevSection title="Theme palettes" note="Values per data-theme.">
        <div className={styles.rows}>
          {Object.entries(THEMES).map(([theme, colors]) => (
            <div
              key={theme}
              className={styles.themeBlock}
              style={{
                background: colors['--color-app'],
                color: colors['--color-text'],
                border: `1px solid ${colors['--color-text-inactive']}`,
              }}
            >
              <span style={{ color: colors['--color-text'] }}>{theme}</span>
              <div className={styles.themeRow}>
                {Object.entries(colors).map(([token, value]) => (
                  <div key={token} className={styles.swatch}>
                    <div
                      className={styles.swatchChip}
                      style={{
                        background: value,
                        width: 120,
                        borderColor: colors['--color-text-inactive'],
                      }}
                    />
                    <span style={{ color: colors['--color-text'] }}>
                      {token.replace('--color-', '')}
                    </span>
                    <span style={{ color: colors['--color-text-secondary'] }}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DevSection>

      <DevSection
        title="Used but not defined"
        note="Referenced in styles with no definition, so they fall back or resolve to nothing."
      >
        <ul className={styles.rows}>
          {UNDEFINED_TOKENS.map((item) => (
            <li key={item.token} className={styles.warn}>
              <span className={styles.code}>{item.token}</span>{' '}
              <span className={styles.muted}>in {item.usedIn}</span>
            </li>
          ))}
        </ul>
      </DevSection>

      <DevSection title="Spacing scale">
        <div className={styles.rows}>
          {SPACING_SCALE.map(([token, value]) => (
            <div key={token} className={styles.row}>
              <div className={styles.rowMeta}>
                <span className={styles.code}>{token}</span>
                <span className={styles.muted}>{value}</span>
              </div>
              <div
                className={styles.spaceBar}
                style={{ width: `var(${token})` }}
              />
            </div>
          ))}
        </div>
      </DevSection>

      <DevSection
        title="Layout spacing"
        note="Semantic spacing; some change at 745px or with the Wide spacing setting."
      >
        <TokenTable rows={SPACING_LAYOUT} />
      </DevSection>

      <DevSection title="Radii and borders">
        <div className={styles.preview}>
          <div
            className={styles.radiusBox}
            style={{ borderRadius: 'var(--border-radius-containers)' }}
          />
          <div
            className={styles.radiusBox}
            style={{ border: 'var(--border-header)' }}
          />
          <div
            className={styles.radiusBox}
            style={{ border: 'var(--border-buttons-inactive)' }}
          />
        </div>
        <TokenTable rows={BORDERS} />
      </DevSection>

      <DevSection title="Sizes, motion and layers">
        <TokenTable rows={MISC} />
      </DevSection>
    </DevShell>
  );
}
