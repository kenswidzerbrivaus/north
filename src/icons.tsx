const paths: Record<string, string> = {
  today:
    'M4 11h16M7 4v2m10-2v2M6 6h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zm2 8h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01',
  tasks:
    'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  calendar:
    'M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zm0 4h16M8 4v3m8-3v3',
  habits: 'M12 21s-7-4.4-7-10a4.5 4.5 0 0 1 7-3.7A4.5 4.5 0 0 1 19 11c0 5.6-7 10-7 10z',
  focus: 'M12 8v4l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  notes: 'M7 4h7l5 5v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm7 0v5h5',
  goals: 'M12 3v3m0 12v3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1M3 12h3m12 0h3M5.6 18.4l2.1-2.1m8.6-8.6 2.1-2.1M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  journal: 'M6 4h11a2 2 0 0 1 2 2v14H8a2 2 0 0 0-2 2V4zm0 0v16',
  settings:
    'M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7zM19.4 13a7.7 7.7 0 0 0 .1-2l2-1.5-2-3.5-2.4 1a7.6 7.6 0 0 0-1.7-1L15 3h-6l-.4 2.5a7.6 7.6 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a7.7 7.7 0 0 0 .1 2l-2 1.5 2 3.5 2.4-1a7.6 7.6 0 0 0 1.7 1L9 21h6l.4-2.5a7.6 7.6 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5z',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 17a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm7 2-3.2-3.2',
  check: 'M5 12l5 5L20 7',
  close: 'M6 6l12 12M18 6L6 18',
  chevron: 'M9 6l6 6-6 6',
  chevronL: 'M15 6l-6 6 6 6',
  sun: 'M12 4V2m0 20v-2M4 12H2m20 0h-2M6.3 6.3 4.9 4.9m14.2 14.2-1.4-1.4M17.7 6.3l1.4-1.4M6.3 17.7 4.9 19.1M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  moon: 'M16 4a8 8 0 1 0 4 12 7 7 0 0 1-4-12z',
  trash: 'M5 7h14M10 7V5h4v2m-7 0 1 13h8l1-13',
  flag: 'M5 21V5h10l-1.5 4L19 13H5',
  play: 'M8 6v12l10-6-10-6z',
  pause: 'M7 6h3v12H7zm7 0h3v12h-3z',
  skip: 'M7 7l7 5-7 5V7zm9 0v10',
  more: 'M6 12h.01M12 12h.01M18 12h.01',
  spark: 'M12 3l1.6 6.4L20 11l-6.4 1.6L12 19l-1.6-6.4L4 11l6.4-1.6L12 3z',
  inbox: 'M4 13h4l2 3h4l2-3h4v6H4v-6zm0 0 3-8h10l3 8',
  edit: 'M4 20h4l10-10-4-4L4 16v4zm11-15 4 4',
  google:
    'M12 11v2.8h4.6c-.2 1.2-1.4 3.4-4.6 3.4A5.1 5.1 0 1 1 12 6.9c1.3 0 2.2.5 2.7 1l1.9-1.8A8 8 0 1 0 12 20.1c4.6 0 7.6-3.2 7.6-7.7 0-.5 0-.9-.1-1.3H12z',
  projects:
    'M4 7h7l2 2h7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z',
}

export function Icon({
  name,
  size = 18,
}: {
  name: keyof typeof paths
  size?: number
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={paths[name]} />
    </svg>
  )
}

export type IconName = keyof typeof paths
