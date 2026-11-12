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
              <SignInButton>
                <Button variant="primary">Sign in</Button>
              </SignInButton>
            </li>
            <li>/</li>
            <li>
              <SignUpButton>
                <Button variant="primary">Sign up</Button>
              </SignUpButton>
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}
