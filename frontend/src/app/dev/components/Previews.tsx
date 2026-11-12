'use client';

import { useState } from 'react';
import { Button } from '@/components/Button/Button';
import { LabeledInput } from '@/components/LabeledInput/LabeledInput';
import { LabeledSelect } from '@/components/LabeledSelect/LabeledSelect';
import { LabelWithCount } from '@/components/LabelWithCount/LabelWithCount';
import { EntryItem } from '@/components/EntryItem/EntryItem';
import { FormattedDate } from '@/components/FormattedDate';
import { IconWrapper } from '@/components/icons/IconWrapper/IconWrapper';
import { IconArrowLeft } from '@/components/icons/IconArrowLeft';
import { IconArrowShortLeft } from '@/components/icons/IconArrowShortLeft';
import { IconArrowShortRight } from '@/components/icons/IconArrowShortRight';
import { IconCategories } from '@/components/icons/IconCategories';
import { IconClose } from '@/components/icons/IconClose';
import { IconEdit } from '@/components/icons/IconEdit';
import { IconExit } from '@/components/icons/IconExit';
import { IconMenu } from '@/components/icons/IconMenu';
import { IconPlus } from '@/components/icons/IconPlus';
import { IconSearch } from '@/components/icons/IconSearch';
import { IconStar } from '@/components/icons/IconStar';
import { Loader } from '@/components/Loader/Loader';
import styles from '../dev.module.sass';

const ICONS = [
  ['IconArrowLeft', IconArrowLeft],
  ['IconArrowShortLeft', IconArrowShortLeft],
  ['IconArrowShortRight', IconArrowShortRight],
  ['IconCategories', IconCategories],
  ['IconClose', IconClose],
  ['IconEdit', IconEdit],
  ['IconExit', IconExit],
  ['IconMenu', IconMenu],
  ['IconPlus', IconPlus],
  ['IconSearch', IconSearch],
  ['IconStar', IconStar],
] as const;

const SAMPLE_DATE = '2026-11-12T08:00:00Z';

function Row({
  name,
  path,
  props,
  stack,
  children,
}: {
  name: string;
  path: string;
  props?: string;
  stack?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.rowMeta}>
        <span>{name}</span>
        <span className={styles.code}>{path}</span>
        {props ? <span className={styles.muted}>{props}</span> : null}
      </div>
      <div
        className={`${styles.preview} ${stack ? styles.previewStack : ''}`}
      >
        {children}
      </div>
    </div>
  );
}

export function PrimitivePreviews() {
  const [inputValue, setInputValue] = useState('');
  const [selectValue, setSelectValue] = useState('');
  const [activePlus, setActivePlus] = useState(false);

  return (
    <div className={styles.rows}>
      <Row
        name="Button · primary"
        path="components/Button"
        props="variant, active, count, icon, collapse"
      >
        <Button>
          <span>Add feed</span>
        </Button>
        <Button count={12}>
          <span>With count</span>
        </Button>
        <Button disabled>
          <span>Disabled</span>
        </Button>
      </Row>
      <Row name="Button · nav" path="components/Button" props="active">
        <Button variant="nav" active>
          <span>Organise</span>
        </Button>
        <Button variant="nav">
          <span>Settings</span>
        </Button>
        <Button variant="nav">
          <span>Info</span>
        </Button>
      </Row>
      <Row name="Button · category" path="components/Button" props="active, count · no styles of its own yet">
        <Button variant="category" active count={8}>
          <span>News</span>
        </Button>
        <Button variant="category" count={3}>
          <span>Design</span>
        </Button>
      </Row>
      <Row
        name="Button · icon"
        path="components/Button"
        props="icon rotates when active (plus)"
      >
        <Button
          variant="icon"
          icon="plus"
          active={activePlus}
          onClick={() => setActivePlus((value) => !value)}
          aria-label="Toggle"
        >
          <IconWrapper>
            <IconPlus />
          </IconWrapper>
        </Button>
        <Button variant="icon" icon="search" aria-label="Search">
          <IconWrapper>
            <IconSearch />
          </IconWrapper>
        </Button>
        <Button variant="icon" icon="menu" aria-label="Menu">
          <IconWrapper>
            <IconMenu />
          </IconWrapper>
        </Button>
      </Row>
      <Row
        name="LabeledInput"
        path="components/LabeledInput"
        props="id, label, value, onChange, placeholder, disabled, type"
        stack
      >
        <LabeledInput
          id="dev-input"
          label="Feed URL"
          value={inputValue}
          onChange={setInputValue}
          placeholder="https://example.com/feed.xml"
        />
        <LabeledInput
          id="dev-input-disabled"
          label="Disabled"
          value=""
          onChange={() => {}}
          placeholder="Not editable"
          disabled
        />
      </Row>
      <Row
        name="LabeledSelect"
        path="components/LabeledSelect"
        props="id, value, onChange, options, placeholder, optionalHint, label"
        stack
      >
        <LabeledSelect
          id="dev-select"
          label="Category"
          value={selectValue}
          onChange={setSelectValue}
          placeholder="Choose a category"
          optionalHint="Optional"
          options={[
            { value: 'news', label: 'News' },
            { value: 'design', label: 'Design' },
          ]}
        />
      </Row>
      <Row
        name="LabelWithCount"
        path="components/LabelWithCount"
        props="count (hidden at 0), as"
      >
        <LabelWithCount count={24}>
          <span>All</span>
        </LabelWithCount>
        <LabelWithCount count="PM">
          <span>10:42</span>
        </LabelWithCount>
        <LabelWithCount count={0}>
          <span>Zero hides count</span>
        </LabelWithCount>
      </Row>
      <Row
        name="IconWrapper"
        path="components/icons/IconWrapper"
        props="variant: default, wide, inverted, small · mirrored"
      >
        {(['default', 'wide', 'inverted', 'small'] as const).map((variant) => (
          <IconWrapper key={variant} variant={variant}>
            <IconArrowShortRight />
          </IconWrapper>
        ))}
        <IconWrapper mirrored>
          <IconArrowShortRight />
        </IconWrapper>
      </Row>
      <Row name="Icons" path="components/icons" props="11 SVG icons">
        {ICONS.map(([name, Icon]) => (
          <span
            key={name}
            title={name}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <IconWrapper>
              <Icon />
            </IconWrapper>
            <span className={styles.code}>{name.replace('Icon', '')}</span>
          </span>
        ))}
      </Row>
      <Row
        name="EntryItem"
        path="components/EntryItem"
        props="title, feedTitle, author, publishedAt, preview, thumbnailUrl, active, marked, starred"
        stack
      >
        <EntryItem
          title="The pattern of sunlight filtering through the leaves"
          feedTitle="Komorebi Journal"
          author="Dries"
          publishedAt={SAMPLE_DATE}
          preview="A short preview of the article, cut after a few lines so the list stays calm."
          marked={false}
        />
        <EntryItem
          title="A read entry"
          feedTitle="Komorebi Journal"
          publishedAt={SAMPLE_DATE}
          marked
        />
      </Row>
      <Row
        name="Loader"
        path="components/Loader"
        props="label, fill · sweep underline, always centered"
        stack
      >
        <div style={{ height: 160 }}>
          <Loader fill />
        </div>
      </Row>
      <Row name="FormattedDate" path="components/FormattedDate" props="date">
        <span>
          <FormattedDate date={SAMPLE_DATE} />
        </span>
      </Row>
    </div>
  );
}
