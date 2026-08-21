import type { SVGProps } from 'react';

/** The icon set. */
export type IconName =
  | 'application'
  | 'package'
  | 'advisory'
  | 'maintainer'
  | 'licence'
  | 'route'
  | 'search'
  | 'arrow-right'
  | 'arrow-down'
  | 'chevron'
  | 'fault'
  | 'clear'
  | 'print'
  | 'external'
  | 'clock'
  | 'depth'
  | 'cut'
  | 'plug';

const PATHS: Record<IconName, React.ReactNode> = {
  application: (
    <>
      <path d="M2 3h12v10H2z" />
      <path d="M2 6h12" />
      <path d="M5 3v3" />
    </>
  ),
  package: (
    <>
      <path d="M8 2l6 3v6l-6 3-6-3V5z" />
      <path d="M2 5l6 3 6-3" />
      <path d="M8 8v6" />
    </>
  ),
  advisory: (
    <>
      <path d="M8 2l6 11H2z" />
      <path d="M8 6v3" />
      <path d="M8 11h.01" />
    </>
  ),
  maintainer: (
    <>
      <path d="M8 3a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z" />
      <path d="M3 14v-1.5C3 10.6 5.2 9.5 8 9.5s5 1.1 5 3V14" />
    </>
  ),
  licence: (
    <>
      <path d="M3.5 2h6l3 3v9h-9z" />
      <path d="M9.5 2v3h3" />
      <path d="M5.5 8.5h5" />
      <path d="M5.5 11h3" />
    </>
  ),
  route: (
    <>
      <path d="M3 3v4h5v6h5" />
      <path d="M1.5 1.5h3v3h-3z" />
      <path d="M11.5 11.5h3v3h-3z" />
      <path d="M6.5 5.5h3v3h-3z" />
    </>
  ),
  search: (
    <>
      <path d="M7 2a5 5 0 1 1 0 10A5 5 0 0 1 7 2z" />
      <path d="M10.7 10.7L14.5 14.5" />
    </>
  ),
  'arrow-right': (
    <>
      <path d="M2.5 8h11" />
      <path d="M9.5 4l4 4-4 4" />
    </>
  ),
  'arrow-down': (
    <>
      <path d="M8 2.5v11" />
      <path d="M4 9.5l4 4 4-4" />
    </>
  ),
  chevron: <path d="M6 3.5L10.5 8 6 12.5" />,
  fault: (
    <>
      <path d="M2.5 2.5h11v11h-11z" />
      <path d="M5.5 5.5l5 5" />
      <path d="M10.5 5.5l-5 5" />
    </>
  ),
  clear: (
    <>
      <path d="M2.5 2.5h11v11h-11z" />
      <path d="M5 8.2l2.2 2.3L11 5.8" />
    </>
  ),
  print: (
    <>
      <path d="M2.5 2.5h11v11h-11z" />
      <path d="M8 2.5v11" />
      <path d="M8 2.5h5.5v11H8z" fill="currentColor" stroke="none" />
    </>
  ),
  external: (
    <>
      <path d="M7 3H3v10h10V9" />
      <path d="M9.5 2.5h4v4" />
      <path d="M13.5 2.5L7.5 8.5" />
    </>
  ),
  clock: (
    <>
      <path d="M8 2a6 6 0 1 1 0 12A6 6 0 0 1 8 2z" />
      <path d="M8 5v3.2l2.2 1.3" />
    </>
  ),
  depth: (
    <>
      <path d="M2.5 3.5h11" />
      <path d="M2.5 8h8" />
      <path d="M2.5 12.5h5" />
    </>
  ),
  cut: (
    <>
      <path d="M2.5 8h11" />
      <path d="M8 2.5v3" />
      <path d="M8 10.5v3" />
      <path d="M5.5 5.5h5v5h-5z" />
    </>
  ),
  plug: (
    <>
      <path d="M4.5 2.5v4" />
      <path d="M11.5 2.5v4" />
      <path d="M2.5 6.5h11v2a3.5 3.5 0 0 1-3.5 3.5H6a3.5 3.5 0 0 1-3.5-3.5z" />
      <path d="M8 12v2.5" />
    </>
  ),
};

type IconProps = SVGProps<SVGSVGElement> & {
  name: IconName;
  /** Pixel size of the square viewport. Defaults to 16. */
  size?: number;
};

export function Icon({ name, size = 16, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
