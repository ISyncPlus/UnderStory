export type Print = 'stock' | 'negative';

export interface TransitionOrigin {
  x: number;
  y: number;
}

const STYLE_ID = 'theme-transition-styles';

// SVG mask with soft Gaussian blur on the boundary
const BLUR_MASK_SVG = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><filter id="b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4"/></filter></defs><circle cx="50" cy="50" r="44" fill="white" filter="url(%23b)"/></svg>`;

function generateCircleBlurCss(origin: TransitionOrigin): string {
  const { x, y } = origin;
  // Calculate maximum distance to any viewport corner
  const maxDist = typeof window !== 'undefined'
    ? Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      )
    : 1500;

  const finalSize = Math.ceil(maxDist * 2.6);
  const halfSize = Math.ceil(finalSize / 2);

  return `
::view-transition-group(root) {
  animation-duration: 0.75s;
  animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
}

::view-transition-new(root) {
  -webkit-mask: url('${BLUR_MASK_SVG}') ${x}px ${y}px / 0px 0px no-repeat;
  mask: url('${BLUR_MASK_SVG}') ${x}px ${y}px / 0px 0px no-repeat;
  animation: circle-blur-expand 0.75s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  transform-origin: ${x}px ${y}px;
}

::view-transition-old(root),
[data-theme="negative"]::view-transition-old(root) {
  animation: none;
  z-index: -1;
}

@keyframes circle-blur-expand {
  0% {
    -webkit-mask-size: 0px 0px;
    mask-size: 0px 0px;
    -webkit-mask-position: ${x}px ${y}px;
    mask-position: ${x}px ${y}px;
  }
  100% {
    -webkit-mask-size: ${finalSize}px ${finalSize}px;
    mask-size: ${finalSize}px ${finalSize}px;
    -webkit-mask-position: ${x - halfSize}px ${y - halfSize}px;
    mask-position: ${x - halfSize}px ${y - halfSize}px;
  }
}
`;
}

function updateTransitionStyles(origin: TransitionOrigin) {
  if (typeof window === 'undefined') return;

  let styleElement = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = STYLE_ID;
    document.head.appendChild(styleElement);
  }

  styleElement.textContent = generateCircleBlurCss(origin);
}

export function applyThemeTransition(
  updateFn: () => void,
  originElementOrCoords?: HTMLElement | TransitionOrigin | null
) {
  if (typeof window === 'undefined') {
    updateFn();
    return;
  }

  let origin: TransitionOrigin;

  if (originElementOrCoords && 'x' in originElementOrCoords && 'y' in originElementOrCoords) {
    origin = originElementOrCoords;
  } else if (originElementOrCoords instanceof HTMLElement) {
    const rect = originElementOrCoords.getBoundingClientRect();
    origin = {
      x: Math.round(rect.left + rect.width / 2),
      y: Math.round(rect.top + rect.height / 2),
    };
  } else {
    // Default to top-right
    origin = {
      x: window.innerWidth - 60,
      y: 30,
    };
  }

  updateTransitionStyles(origin);

  if (!document.startViewTransition) {
    updateFn();
    return;
  }

  document.startViewTransition(() => {
    updateFn();
  });
}
