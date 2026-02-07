'use client';

import { useMemo } from 'react';
import styles from './EntryItemYoutube.module.sass';
import { FormattedDate } from '../FormattedDate';
import { getYouTubeEmbedUrl } from '@/lib/youtube';

export type EntryItemYoutubeProps = {
  title?: string;
  feedTitle?: string;
  author?: string;
  publishedAt?: string;
  videoId: string;
  marked: boolean;
};

export function EntryItemYoutube({
  title,
  feedTitle,
  author,
  publishedAt,
  videoId,
  marked,
}: EntryItemYoutubeProps) {
  const embedUrl = useMemo(() => getYouTubeEmbedUrl(videoId), [videoId]);
  const byline = author ? `${author}${feedTitle ? `, ${feedTitle}` : ''}` : feedTitle;

  return (
    <div className={styles.entryItemYoutube} data-marked={marked ? 'true' : 'false'}>
      <div className={styles.entryItemYoutube_Player}>
        <iframe
          className={styles.entryItemYoutube_Iframe}
          src={embedUrl}
          title={title || 'YouTube video'}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation"
          allowFullScreen
        />
      </div>

      <div className={styles.entryItemYoutube_Body}>
        <div className={styles.entryItemYoutube_Header}>
          <div className={styles.entryItemYoutube_Title}>
            {title || '(untitled)'}
          </div>

          <div className={styles.entryItemYoutube_Meta}>
            <p>
              <FormattedDate date={publishedAt} />
            </p>
            <div className={styles.entryItemYoutube_From}>
              <p>From</p>
              {byline ? (
                <i className={styles.entryItemYoutube_FromText}>{byline}</i>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

