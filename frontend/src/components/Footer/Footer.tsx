import styles from './Footer.module.sass';

export function Footer() {
  return (
    <div className={styles.footer}>
      <ul className={styles.footer_List}>
        <li className={styles.footer_Item}>
          <a href="mailto:info@driesbos.com">Feedback</a>
        </li>
        <li className={styles.footer_Item}>
          <a href="https://peace.blog/newsletter">Newsletter</a>
        </li>
        <li className={styles.footer_Item}>
          <a href="https://www.instagram.com/dries_bos">IG</a>
        </li>
      </ul>
    </div>
  );
}
