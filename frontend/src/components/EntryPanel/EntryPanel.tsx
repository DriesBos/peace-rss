'use client';

import Image from 'next/image';
import { createElement, useEffect, useMemo, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import IntersectionImage from 'react-intersection-image';
import styles from './EntryPanel.module.sass';
import { SlidePanel } from '@/components/SlidePanel/SlidePanel';
import { FormattedDate } from '@/components/FormattedDate';
import { Button } from '@/components/Button/Button';
import buttonStyles from '@/components/Button/Button.module.sass';
import { IconArrowShortLeft } from '@/components/icons/IconArrowShortLeft';
import { IconArrowShortRight } from '@/components/icons/IconArrowShortRight';
import { ScrollToTop } from '@/components/ScrollToTop/ScrollToTop';
import type { Entry, Feed } from '@/app/_lib/types';
import { extractYouTubeVideoId, getYouTubeEmbedUrl } from '@/lib/youtube';
import { IconWrapper } from '../icons/IconWrapper/IconWrapper';
import { IconStar } from '../icons/IconStar';
import { IconExit } from '../icons/IconExit';

type LazyEntryContent = {
  nodes: ReactNode[];
  leadImage: LeadImageData | null;
};

type LeadImageData = {
  url: string;
  width?: number;
  height?: number;
};

type YouTubeInlineProps = {
  videoId: string;
  href?: string;
  title?: string;
};

const SWIPE_THRESHOLD_PX = 60;
const SWIPE_MAX_VERTICAL_PX = 50;

function YouTubeInline({ videoId, href, title }: YouTubeInlineProps) {
  const embedUrl = getYouTubeEmbedUrl(videoId);

  return (
    <div className={styles.youtube}>
      <div className={styles.youtube_Player}>
        <iframe
          className={styles.youtube_Iframe}
          src={embedUrl}
          title={title || 'YouTube video'}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation"
          allowFullScreen
        />
      </div>
      {href ? (
        <a
          className={styles.youtube_Link}
          href={href}
          target="_blank"
          rel="noreferrer"
        >
          Open on YouTube
        </a>
      ) : null}
    </div>
  );
}

function resolveUrl(value: string, baseUrl?: string): string {
  if (!baseUrl) return value;

  try {
    return new URL(value, baseUrl).href;
  } catch {
    return value;
  }
}

function resolveSrcSet(value: string, baseUrl?: string): string {
  if (!baseUrl) return value;

  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [url, ...rest] = part.split(/\s+/);
      const resolvedUrl = resolveUrl(url, baseUrl);
      return [resolvedUrl, ...rest].join(' ');
    })
    .join(', ');
}

function useLazyEntryContent(html?: string, baseUrl?: string) {
  return useMemo<LazyEntryContent | null>(() => {
    const canUseDom =
      typeof window !== 'undefined' && typeof window.DOMParser !== 'undefined';

    if (!html || !canUseDom) return null;

    try {
      const parser = new window.DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const leadImage = extractLeadImage(doc, baseUrl);
      leadImage?.cleanup?.();
      return {
        nodes: convertDocToReactNodes(doc, baseUrl),
        leadImage: leadImage
          ? {
              url: leadImage.url,
              width: leadImage.width,
              height: leadImage.height,
            }
          : null,
      };
    } catch {
      return null;
    }
  }, [html, baseUrl]);
}

type ExtractedLeadImage = {
  url: string;
  width?: number;
  height?: number;
  cleanup?: () => void;
};

function extractLeadImage(
  doc: Document,
  baseUrl?: string,
): ExtractedLeadImage | null {
  const blocks = Array.from(doc.body.children).slice(0, 4);

  for (const block of blocks) {
    const tagName = block.tagName.toLowerCase();

    let img: HTMLImageElement | null = null;
    let elementToRemove: Element | null = null;

    if (tagName === 'img') {
      img = block as HTMLImageElement;
      elementToRemove = block;
    } else {
      img = block.querySelector('img') as HTMLImageElement | null;
      if (img) {
        const hasNonWhitespaceText = Boolean(block.textContent?.trim());
        const childElements = Array.from(block.children);
        const hasOnlyImageElement =
          childElements.length === 1 && childElements[0] === img;

        if (!hasNonWhitespaceText && hasOnlyImageElement) {
          elementToRemove = block;
        } else {
          img = null;
        }
      }
    }

    if (img) {
      const src =
        img.getAttribute('src') ||
        img.getAttribute('data-src') ||
        img.getAttribute('data-lazy-src') ||
        img.getAttribute('data-original') ||
        '';
      const trimmed = src.trim();
      if (!trimmed) continue;

      const widthAttr = img.getAttribute('width');
      const heightAttr = img.getAttribute('height');
      const parsedWidth = widthAttr ? Number.parseInt(widthAttr, 10) : NaN;
      const parsedHeight = heightAttr ? Number.parseInt(heightAttr, 10) : NaN;

      const resolvedUrl = resolveUrl(trimmed, baseUrl);

      return {
        url: resolvedUrl,
        width:
          Number.isFinite(parsedWidth) && parsedWidth > 0
            ? parsedWidth
            : undefined,
        height:
          Number.isFinite(parsedHeight) && parsedHeight > 0
            ? parsedHeight
            : undefined,
        cleanup: elementToRemove
          ? () => {
              elementToRemove.remove();
            }
          : undefined,
      };
    }
  }

  return null;
}

function convertDocToReactNodes(doc: Document, baseUrl?: string): ReactNode[] {
  return Array.from(doc.body.childNodes)
    .map((node, index) =>
      transformNodeToReact(node, `entry-node-${index}`, baseUrl),
    )
    .filter(
      (child): child is ReactNode => child !== null && child !== undefined,
    );
}

const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

type ElementProps = Record<string, unknown> & {
  className?: string;
  style?: CSSProperties;
};

function transformNodeToReact(
  node: ChildNode,
  key: string,
  baseUrl?: string,
): ReactNode | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const element = node as HTMLElement;
  const tagName = element.tagName.toLowerCase();

  if (tagName === 'script' || tagName === 'style') {
    return null;
  }

  if (tagName === 'p' || tagName === 'div') {
    const hasNonWhitespaceText = Array.from(element.childNodes).some(
      (child) =>
        child.nodeType === Node.TEXT_NODE && Boolean(child.textContent?.trim()),
    );
    const childElements = Array.from(element.children);
    if (!hasNonWhitespaceText && childElements.length === 1) {
      const onlyChild = childElements[0] as HTMLElement;
      if (onlyChild.tagName.toLowerCase() === 'a') {
        const rawHref = onlyChild.getAttribute('href') ?? '';
        const resolvedHref = rawHref ? resolveUrl(rawHref, baseUrl) : '';
        const videoId = rawHref ? extractYouTubeVideoId(resolvedHref) : null;
        if (videoId) {
          return (
            <YouTubeInline
              key={key}
              videoId={videoId}
              href={resolvedHref}
              title={onlyChild.textContent ?? undefined}
            />
          );
        }
      }
    }
  }

  if (tagName === 'iframe') {
    const src = element.getAttribute('src') ?? '';
    const videoId = extractYouTubeVideoId(src);
    if (!videoId) return null;
    return <YouTubeInline key={key} videoId={videoId} />;
  }

  if (tagName === 'img') {
    return createLazyImageElement(element as HTMLImageElement, key, baseUrl);
  }

  const props = buildElementProps(element, { baseUrl });

  if (VOID_ELEMENTS.has(tagName)) {
    return createElement(tagName, { ...props, key });
  }

  const children = Array.from(element.childNodes).map((child, childIndex) =>
    transformNodeToReact(child, `${key}-${childIndex}`, baseUrl),
  );

  return createElement(tagName, { ...props, key }, children);
}

function buildElementProps(
  element: Element,
  options: { omit?: string[]; baseUrl?: string } = {},
): ElementProps {
  const props: ElementProps = {};
  const omit = new Set(
    (options.omit ?? []).map((attrName) => attrName.toLowerCase()),
  );

  Array.from(element.attributes).forEach((attr) => {
    const lowerName = attr.name.toLowerCase();
    if (omit.has(lowerName)) {
      return;
    }

    if (lowerName.startsWith('on')) {
      return;
    }

    if (lowerName === 'style') {
      const styleObj = styleStringToObject(attr.value);
      if (styleObj) {
        props.style = { ...(props.style ?? {}), ...styleObj };
      }
      return;
    }

    const mappedName = mapAttributeName(attr.name);

    if (mappedName === 'href') {
      const rawHref = attr.value.trim();
      if (/^javascript:/i.test(rawHref)) {
        return;
      }
      props[mappedName] = options.baseUrl
        ? resolveUrl(rawHref, options.baseUrl)
        : rawHref;
      return;
    }

    if (mappedName === 'className') {
      props.className = props.className
        ? `${props.className} ${attr.value}`
        : attr.value;
      return;
    }

    props[mappedName] = attr.value;
  });

  return props;
}

function createLazyImageElement(
  element: HTMLImageElement,
  key: string,
  baseUrl?: string,
): ReactNode | null {
  const src = element.getAttribute('src');

  if (!src) {
    return null;
  }

  const baseProps = buildElementProps(element, {
    omit: ['src', 'srcset', 'sizes'],
  });

  const {
    className: htmlClassName,
    style: htmlStyle,
    ...restProps
  } = baseProps;

  const combinedClassName = [styles.lazyEntryImage, htmlClassName]
    .filter(Boolean)
    .join(' ')
    .trim();

  const mergedStyle: CSSProperties = {
    ...(htmlStyle ?? {}),
  };

  if (!mergedStyle.transition) {
    mergedStyle.transition = 'opacity 0.6s ease-in-out';
  }

  const resolvedSrc = resolveUrl(src, baseUrl);
  const srcSet = element.getAttribute('srcset');
  const resolvedSrcSet = srcSet ? resolveSrcSet(srcSet, baseUrl) : null;
  const sizes = element.getAttribute('sizes');
  const alt = element.getAttribute('alt') ?? '';

  return (
    <IntersectionImage
      key={key}
      {...restProps}
      src={resolvedSrc}
      alt={alt}
      srcSet={resolvedSrcSet ?? undefined}
      sizes={sizes ?? undefined}
      className={combinedClassName || undefined}
      style={Object.keys(mergedStyle).length ? mergedStyle : {}}
    />
  );
}

function styleStringToObject(value: string): CSSProperties | undefined {
  const declarations = value
    .split(';')
    .map((declaration) => declaration.trim())
    .filter(Boolean);

  if (declarations.length === 0) {
    return undefined;
  }

  const styleObject: Record<string, string> = {};

  declarations.forEach((declaration) => {
    const separatorIndex = declaration.indexOf(':');
    if (separatorIndex === -1) {
      return;
    }

    const property = declaration.slice(0, separatorIndex).trim();
    const rawValue = declaration.slice(separatorIndex + 1).trim();

    if (!property || !rawValue) {
      return;
    }

    const camelCased = property.startsWith('--')
      ? property
      : property.replace(/-([a-z])/g, (_, char) => char.toUpperCase());

    styleObject[camelCased] = rawValue;
  });

  return Object.keys(styleObject).length
    ? (styleObject as CSSProperties)
    : undefined;
}

function mapAttributeName(name: string): string {
  const normalized = name.toLowerCase();

  switch (normalized) {
    case 'class':
      return 'className';
    case 'for':
      return 'htmlFor';
    case 'http-equiv':
      return 'httpEquiv';
    case 'accept-charset':
      return 'acceptCharset';
    case 'maxlength':
      return 'maxLength';
    case 'tabindex':
      return 'tabIndex';
    case 'readonly':
      return 'readOnly';
    case 'colspan':
      return 'colSpan';
    case 'rowspan':
      return 'rowSpan';
    case 'frameborder':
      return 'frameBorder';
    case 'allowfullscreen':
      return 'allowFullScreen';
    case 'srcset':
      return 'srcSet';
    default:
      return name;
  }
}

export type EntryPanelProps = {
  entry: Entry | null;
  feedsById: Map<number, Feed>;
  onClose: () => void;
  onToggleStar: () => void;
  onFetchOriginal: () => void;
  fetchingOriginal: boolean;
  originalFetchStatus?: 'success' | 'error';
  onSetStatus: (status: 'read' | 'unread') => void;
  onNavigatePrev: () => void;
  onNavigateNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  isTogglingStar: boolean;
  isUpdatingStatus: boolean;
};

export function EntryPanel({
  entry,
  feedsById,
  onClose,
  onToggleStar,
  onFetchOriginal,
  fetchingOriginal,
  originalFetchStatus,
  onSetStatus,
  onNavigatePrev,
  onNavigateNext,
  hasPrev,
  hasNext,
  isTogglingStar,
  isUpdatingStatus,
}: EntryPanelProps) {
  const lazy = useLazyEntryContent(entry?.content, entry?.url);
  const selectedIsStarred = Boolean(entry?.starred);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const entryId = entry?.id ?? null;

  const leadImage = lazy?.leadImage ?? null;
  const leadImageUrl = leadImage?.url.trim() || null;
  const pinnedLeadImage = leadImageUrl
    ? {
        url: leadImageUrl,
        width: leadImage?.width,
        height: leadImage?.height,
      }
    : null;

  useEffect(() => {
    if (entryId === null) return;

    const node = scrollContainerRef.current;
    if (!node) return;

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const onTouchEnd = (event: TouchEvent) => {
      const swipeStart = swipeStartRef.current;
      swipeStartRef.current = null;

      if (!swipeStart) return;
      const touch = event.changedTouches?.[0];
      if (!touch) return;

      const deltaX = touch.clientX - swipeStart.x;
      const deltaY = touch.clientY - swipeStart.y;

      if (
        Math.abs(deltaX) < SWIPE_THRESHOLD_PX ||
        Math.abs(deltaY) > SWIPE_MAX_VERTICAL_PX
      ) {
        return;
      }

      if (deltaX < 0 && hasNext) {
        onNavigateNext();
      } else if (deltaX > 0 && hasPrev) {
        onNavigatePrev();
      }
    };

    const onTouchCancel = () => {
      swipeStartRef.current = null;
    };

    node.addEventListener('touchstart', onTouchStart, { passive: true });
    node.addEventListener('touchend', onTouchEnd, { passive: true });
    node.addEventListener('touchcancel', onTouchCancel);

    return () => {
      node.removeEventListener('touchstart', onTouchStart);
      node.removeEventListener('touchend', onTouchEnd);
      node.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [entryId, hasNext, hasPrev, onNavigateNext, onNavigatePrev]);

  return (
    <SlidePanel
      isOpen={!!entry}
      onClose={onClose}
      ariaLabel="Entry details"
      scrollContainerRef={scrollContainerRef}
    >
      <ScrollToTop
        containerRef={scrollContainerRef}
        triggerKey={entry?.id}
        isActive={!!entry}
      />
      {entry && (
        <div className={styles.entry_Container}>
          <div className={styles.entry_Header}>
            <h1>{entry.title || '(untitled)'}</h1>
            <div className={styles.entry_Meta}>
              {(entry.feed_title ??
                entry.feed?.title ??
                feedsById.get(entry.feed_id)?.title) ||
              entry.published_at ||
              entry.author ? (
                <>
                  {entry.published_at && (
                    <p>
                      <FormattedDate date={entry.published_at} />
                    </p>
                  )}
                  <p>
                    From:{' '}
                    <i>
                      {entry.author && `By: ${entry.author}, `}
                      {entry.feed_title ??
                        entry.feed?.title ??
                        feedsById.get(entry.feed_id)?.title ??
                        ''}
                    </i>
                  </p>
                </>
              ) : null}
            </div>
          </div>

          {entry.content ? (
            lazy ? (
              <div className={styles.entry_Content}>
                {pinnedLeadImage ? (
                  <div
                    className={styles.entry_LeadImageWrapper}
                    style={
                      pinnedLeadImage.width && pinnedLeadImage.height
                        ? {
                            aspectRatio: `${pinnedLeadImage.width} / ${pinnedLeadImage.height}`,
                          }
                        : undefined
                    }
                  >
                    <Image
                      className={styles.entry_LeadImage}
                      src={pinnedLeadImage.url}
                      alt=""
                      fill
                      sizes="(max-width: 745px) 100vw, 800px"
                      quality={75}
                      unoptimized
                      loading="lazy"
                      style={{ objectFit: 'contain' }}
                    />
                  </div>
                ) : null}
                {lazy.nodes}
              </div>
            ) : (
              <div
                className={styles.entry_Content}
                dangerouslySetInnerHTML={{
                  __html: entry.content,
                }}
              />
            )
          ) : (
            <div className={styles.content}>
              <div className={styles.entry_noContent}>
                No content available.
              </div>
              <div>
                <a
                  className={styles.link}
                  href={entry.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open source
                </a>
              </div>
            </div>
          )}
          <div className={styles.entry_Footer}>
            <div className={styles.actionsList}>
              <Button
                variant="primary"
                onClick={onToggleStar}
                disabled={isTogglingStar}
                title={selectedIsStarred ? 'Unstar' : 'Star'}
                aria-pressed={selectedIsStarred}
                aria-label={selectedIsStarred ? 'Unstar entry' : 'Star entry'}
                type="button"
                className={styles.actionsList_Item}
              >
                <IconWrapper>
                  <IconStar />
                </IconWrapper>
                <span>{selectedIsStarred ? 'Unstar' : 'Star'}</span>
              </Button>
              <a
                href={entry.url}
                target="_blank"
                rel="noreferrer"
                title="Source link"
                className={`${buttonStyles.button} ${buttonStyles.primary} ${styles.actionsList_Item}`}
              >
                <span>Source link</span>
                <IconWrapper variant="small">
                  <IconExit />
                </IconWrapper>
              </a>
              <Button
                onClick={onFetchOriginal}
                disabled={fetchingOriginal}
                title={
                  fetchingOriginal
                    ? 'Fetching soure...'
                    : originalFetchStatus === 'success'
                      ? 'Refetch source'
                      : originalFetchStatus === 'error'
                        ? 'Retry fetching source'
                        : 'Fetch source'
                }
                className={styles.actionsList_Item}
              >
                <span>
                  {fetchingOriginal
                    ? 'Fetching source...'
                    : originalFetchStatus === 'success'
                      ? 'Source fetched'
                      : originalFetchStatus === 'error'
                        ? 'Retry fetching source'
                        : 'Fetch source'}
                </span>
              </Button>
              <Button
                onClick={() =>
                  onSetStatus(entry.status === 'unread' ? 'read' : 'unread')
                }
                disabled={isUpdatingStatus}
                type="button"
                title={
                  entry.status === 'unread' ? 'Mark as read' : 'Mark as unread'
                }
                className={styles.actionsList_Item}
              >
                <span>
                  {entry.status === 'unread'
                    ? 'Mark as read'
                    : 'Mark as unread'}
                </span>
              </Button>
            </div>
            <div className={styles.prevNextButtons}>
              <Button
                onClick={onNavigatePrev}
                disabled={!hasPrev}
                type="button"
                variant="nav"
              >
                <IconWrapper>
                  <IconArrowShortLeft />
                </IconWrapper>
                <span>Prev</span>
              </Button>
              <Button
                onClick={onNavigateNext}
                disabled={!hasNext}
                type="button"
                variant="nav"
              >
                <span>Next</span>
                <IconWrapper mirrored>
                  <IconArrowShortRight />
                </IconWrapper>
              </Button>
            </div>
          </div>
        </div>
      )}
    </SlidePanel>
  );
}
