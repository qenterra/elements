import type { SVGProps } from 'react'

/** Elements brand mark: a selected page element with an active pointer. */
export function BrandMark({ width = 24, height = 24, ...props }: SVGProps<SVGSVGElement>) {
  return <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width={width}
    height={height}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M9 4.5H6.5a2 2 0 0 0-2 2V9m10.5-4.5h2.5a2 2 0 0 1 2 2V9m0 6v2.5a2 2 0 0 1-2 2H15m-6 0H6.5a2 2 0 0 1-2-2V15"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      opacity=".78"
    />
    <path d="M9 8.25v8.5l2.24-2.14 1.75 3.28 1.84-.98-1.75-3.27 3.05-.51L9 8.25Z" fill="currentColor" />
  </svg>
}
