import styles from './EntryItem.module.sass';
import { FormattedDate } from '../FormattedDate';

type EntryItemProps = {
  title?: string;
  feedTitle?: string;
  author?: string;
  publishedAt?: string;
  content?: string;
  active?: boolean;
  onClick?: () => void;
};

/**
 * Creates a plain text preview from HTML content
 * @param htmlContent - HTML string to convert
 * @param maxLength - Maximum character length (default: 200)
 * @returns Plain text preview with ellipsis if truncated
 */
function createPreview(
  htmlContent: string | undefined,
  maxLength = 200
): string {
  if (!htmlContent) return '';

  // Strip HTML tags
  const textOnly = htmlContent
    .replace(/<[^>]*>/g, ' ')
    // Replace multiple spaces/newlines with single space
    .replace(/\s+/g, ' ')
    // Decode common HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();

  if (textOnly.length <= maxLength) return textOnly;

  // Truncate at word boundary to avoid cutting words
  const truncated = textOnly.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + '…';
}

export function EntryItem({
  title,
  feedTitle,
  author,
  publishedAt,
  content,
  active,
  onClick,
}: EntryItemProps) {
  // Generate preview from content
  const preview = createPreview(content, 200);

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
              By:{' '}
              <i>
                {author}, {feedTitle}
              </i>
            </p>
            <p>
              <FormattedDate date={publishedAt} />
            </p>
          </div>
        </div>
        {preview && <p className={styles.entryItem_Preview}>{preview}</p>}
      </div>
    </div>
  );
}
