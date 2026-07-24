import type { SVGProps } from 'react'

/** Elements brand mark: a selected page element with editable text rows. */
export function BrandMark({ width = 24, height = 24, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
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
        d="M9 4H6.5A2.5 2.5 0 0 0 4 6.5V9m11-5h2.5A2.5 2.5 0 0 1 20 6.5V9m0 6v2.5a2.5 2.5 0 0 1-2.5 2.5H15m-6 0H6.5A2.5 2.5 0 0 1 4 17.5V15"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 8.75h8m-8 3.25h5.5m-5.5 3.25h6.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}
