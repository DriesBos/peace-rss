'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import styles from './EntryItemYoutube.module.sass';
import { FormattedDate } from '../FormattedDate';
import { getYouTubeEmbedUrl, getYouTubePosterUrl } from '@/lib/youtube';

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
  const [isPlaying, setIsPlaying] = useState(false);
  const autoplayUrl = useMemo(
    () => getYouTubeEmbedUrl(videoId, { autoplay: true }),
    [videoId],
  );
  const posterUrl = useMemo(() => getYouTubePosterUrl(videoId), [videoId]);
  const byline = author ? `${author}${feedTitle ? `, ${feedTitle}` : ''}` : feedTitle;

  return (
    <div className={styles.entryItemYoutube} data-marked={marked ? 'true' : 'false'}>
      <div className={styles.entryItemYoutube_Player}>
        {isPlaying ? (
          <iframe
            className={styles.entryItemYoutube_Iframe}
            src={autoplayUrl}
            title={title || 'YouTube video'}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation"
            allowFullScreen
          />
        ) : (
          <>
            <Image
              src={posterUrl}
              alt=""
              fill
              sizes="(max-width: 745px) 100vw, 376px"
              quality={60}
              unoptimized
              loading="lazy"
              style={{ objectFit: 'cover' }}
            />
            <button
              type="button"
              className={styles.entryItemYoutube_PlayButton}
              aria-label={title ? `Play: ${title}` : 'Play video'}
              onClick={() => setIsPlaying(true)}
            />
          </>
        )}
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
