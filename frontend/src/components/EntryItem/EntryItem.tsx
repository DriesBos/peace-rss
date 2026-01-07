import styles from './EntryItem.module.sass';
import { FormattedDate } from '../FormattedDate';

type EntryItemProps = {
  title?: string;
  feedTitle?: string;
  author?: string;
  publishedAt?: string;
  url?: string;
  content?: string;
  summary?: string;
  feedId?: number;
  feed?: { id: number; title: string };
  active?: boolean;
  onClick?: () => void;
};

export function EntryItem({
  title,
  feedTitle,
  author,
  publishedAt,
  content,
  summary,
  feedId,
  feed,
  active,
  onClick,
}: EntryItemProps) {
  return (
    <div
      className={styles.entryItem}
      data-active={active}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <div className={styles.entryItem_Body}>
        <div className={styles.entryItem_Header}>
          <h1>{title}</h1>
          <div className={styles.entryItem_Meta}>
            <p>
              By: <i>{author || feedTitle}</i>
            </p>
            <p>
              <FormattedDate date={publishedAt} />
            </p>
          </div>
        </div>
        {summary && <p>{summary}</p>}
        {/* <p>{url}</p>
      <p>{content}</p>
      <p>{summary}</p>
      <p>{feedId}</p> */}
        {/* <p>{feed.title}</p> */}
      </div>
    </div>
  );
}
