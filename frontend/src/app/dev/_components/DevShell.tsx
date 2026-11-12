import Link from 'next/link';
import { EscapeToHome } from '@/components/EscapeToHome/EscapeToHome';
import { BackButton } from '@/components/BackButton/BackButton';
import { DEV_PAGES } from '@/lib/devTools';
import styles from '../dev.module.sass';

type DevShellProps = {
  current: (typeof DEV_PAGES)[number]['href'];
  intro?: React.ReactNode;
  children: React.ReactNode;
};

export function DevShell({ current, intro, children }: DevShellProps) {
  const page = DEV_PAGES.find((item) => item.href === current);

  return (
    <div className={styles.devPage}>
      <EscapeToHome />
      <div className={styles.content}>
        <BackButton />
        <div className={styles.inner}>
          <nav className={styles.devNav} aria-label="Dev pages">
            {DEV_PAGES.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                data-active={item.href === current}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <header className={styles.pageHeader}>
            <h1>{page?.label}</h1>
            {intro ? <p className={styles.muted}>{intro}</p> : null}
          </header>
          {children}
        </div>
      </div>
    </div>
  );
}

type SectionProps = {
  title: string;
  note?: React.ReactNode;
  children: React.ReactNode;
};

export function DevSection({ title, note, children }: SectionProps) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2>{title}</h2>
        {note ? <p className={styles.muted}>{note}</p> : null}
      </div>
      {children}
    </section>
  );
}
