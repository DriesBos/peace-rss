import { BackButton } from '@/components/BackButton/BackButton';
import { DevShell, DevSection } from '../_components/DevShell';
import { PrimitivePreviews } from './Previews';
import styles from '../dev.module.sass';

export const metadata = { title: 'Component system · Dev' };

const COMPOSITES = [
  ['ModalContainer', 'Animated modal shell with focus trap; wraps Menu, Add and Edit modals'],
  ['SlidePanel', 'GSAP slide-in panel with overlay and focus trap; hosts EntryPanel'],
  ['MenuModal', 'Menu with Organise, Settings, Info (and Dev) tabs'],
  ['AddModal', 'Add feed or category form'],
  ['EditModal', 'Edit or delete a feed or category'],
  ['EntryList', 'Virtualised list of EntryItem'],
  ['EntryPanel', 'Article reader: header, meta, sanitised content'],
  ['TheHeader', 'Top bar with category tabs and actions'],
  ['Footer', 'Page footer links'],
  ['LandingPage', 'Signed-out landing with wordmark'],
  ['KomorebiShader', 'Leaf shadow layer; Desktop, Safari and iOS variants'],
  ['MainKomorebiLayer', 'Places the shader behind content'],
];

const UTILITIES = [
  ['EscapeToHome', 'Escape key returns to /'],
  ['GlobalKeybindings', 'App-wide keyboard shortcuts'],
  ['ScrollToTop', 'Scroll reset on route change'],
  ['ThemeProvider', 'next-themes provider (light, dark, night)'],
  ['QueryProvider', 'TanStack Query client'],
  ['FontFamilyController', 'Applies data-font-family to body'],
  ['TypeSizeController', 'Applies data-type-size to body'],
  ['SpacingWideController', 'Applies data-spacing-wide to body'],
  ['KomorebiMainController', 'Applies the Komorebi setting'],
  ['Notifications', 'sonner toaster'],
];

function CatalogTable({ rows }: { rows: string[][] }) {
  return (
    <div className={styles.tableScroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Component</th>
            <th>Role</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, role]) => (
            <tr key={name}>
              <td className={styles.code}>{name}</td>
              <td>{role}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ComponentSystemPage() {
  return (
    <DevShell
      current="/dev/components"
      intro="Reusable components in src/components. Primitives render live; composite and stateful ones are listed."
    >
      <DevSection title="Primitives" note="Live, with their real styles.">
        <PrimitivePreviews />
        <div className={styles.row}>
          <div className={styles.rowMeta}>
            <span>BackButton</span>
            <span className={styles.code}>components/BackButton</span>
            <span className={styles.muted}>href, label, ariaLabel</span>
          </div>
          <div className={styles.preview}>
            <BackButton href="/dev/components" label="Back" />
          </div>
        </div>
      </DevSection>

      <DevSection
        title="Composite components"
        note="Need app data or open state, so not rendered here."
      >
        <CatalogTable rows={COMPOSITES} />
      </DevSection>

      <DevSection title="Providers and controllers" note="No UI of their own.">
        <CatalogTable rows={UTILITIES} />
      </DevSection>
    </DevShell>
  );
}
