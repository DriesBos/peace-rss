'use client';

import { createElement, useMemo, useRef } from 'react';
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
import { IconWrapper } from '../icons/IconWrapper/IconWrapper';
import { IconStar } from '../icons/IconStar';
import { IconExit } from '../icons/IconExit';

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
  return useMemo<ReactNode[] | null>(() => {
    const canUseDom =
      typeof window !== 'undefined' && typeof window.DOMParser !== 'undefined';

    if (!html || !canUseDom) return null;

    try {
      return convertHtmlToReactNodes(html, baseUrl);
    } catch {
      return null;
    }
  }, [html, baseUrl]);
}

function convertHtmlToReactNodes(html: string, baseUrl?: string): ReactNode[] {
  const parser = new window.DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

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
  const lazyEntryContent = useLazyEntryContent(entry?.content, entry?.url);
  const selectedIsStarred = Boolean(entry?.starred);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

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
            lazyEntryContent ? (
              <div className={styles.entry_Content}>{lazyEntryContent}</div>
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
