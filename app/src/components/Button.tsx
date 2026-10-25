import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { Icon, type IconName } from './icons';

// Actions look like actions (LA-PAT-APP-UX-R09): every standalone action is this one component.
//  - ghost, the default: no border or fill, the hover tint, the shared focus ring;
//  - primary: filled with the accent, for the one main action of a form or dialog;
//  - icon: a square ghost button that holds only an icon, so it must be given a name.
// It renders a <button>, or a real <a href> styled as a button when it navigates, so Cmd-click still opens a tab.
// A link that needs the app's router (Link, SpecLink) takes buttonClass() instead.

export type ButtonVariant = 'ghost' | 'primary' | 'icon';

type Look = {
  variant?: ButtonVariant;
  /** A leading icon, drawn before the text. */
  icon?: IconName;
  /** A destructive action: ghost in the error color. */
  danger?: boolean;
  /** The accessible name; required for the icon variant, whose only content is an icon. */
  label?: string;
  className?: string;
  children?: ReactNode;
};

type AsButton = Look & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> & { href?: undefined; ref?: Ref<HTMLButtonElement> };
type AsLink = Look & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'children'> & { href: string; ref?: Ref<HTMLAnchorElement> };

export type ButtonProps = (AsButton | AsLink) & ({ variant?: 'ghost' | 'primary' } | { variant: 'icon'; label: string });

/** The classes of a button of this look, for a router link that must look like one. */
export function buttonClass(variant: ButtonVariant = 'ghost', { danger = false, className }: { danger?: boolean; className?: string } = {}): string {
  const look = variant === 'icon' ? 'icon-button' : `button button-${variant}`;
  return [look, danger ? 'button-danger' : '', className ?? ''].filter(Boolean).join(' ');
}

export function Button(props: ButtonProps) {
  const { variant = 'ghost', icon, danger, label, className, children, ...rest } = props;
  const look = buttonClass(variant, { danger, className });
  const content = (
    <>
      {icon && <Icon name={icon} size={variant === 'icon' ? 16 : 15} />}
      {children}
    </>
  );
  if (rest.href !== undefined) {
    const anchor = rest as Omit<AsLink, keyof Look>;
    return <a {...anchor} className={look} aria-label={label ?? anchor['aria-label']}>{content}</a>;
  }
  const button = rest as Omit<AsButton, keyof Look>;
  return <button type="button" {...button} className={look} aria-label={label ?? button['aria-label']}>{content}</button>;
}
