import { SignInButton, SignUpButton } from '@clerk/nextjs';
import { Button } from '@/components/Button/Button';
import KomorebiShader from '@/components/KomorebiShader/KomorebiShader';
import styles from './LandingPage.module.sass';

export function LandingPage() {
  return (
    <>
      <KomorebiShader opacity={0.1} />
      <div className={styles.landingPage}>
        <div className={styles.content}>
          <div className={styles.intro}>
            <h1 className={styles.soulSister}>Komorebi</h1>
            <p>Enjoy your reading</p>
          </div>
          <ul className={styles.buttons}>
            <li>
              <Button variant="primary">
                <SignInButton />
              </Button>
            </li>
            <li>/</li>
            <li>
              <Button variant="primary">
                <SignUpButton />
              </Button>
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}
