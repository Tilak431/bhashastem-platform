import type { SVGProps } from 'react';

export function PhysicsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <ellipse cx="12" cy="5" rx="3" ry="8" />
      <ellipse cx="12" cy="5" rx="8" ry="3" transform="rotate(90 12 5)" />
      <path d="M12 12a2 2 0 1 0-4 0 2 2 0 1 0 4 0Z" />
    </svg>
  );
}

export function ChemistryIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M5 8h14" />
      <path d="M5 8a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4" />
      <path d="M19 8v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8" />
      <path d="M12 12a3 3 0 0 0 0 6" />
    </svg>
  );
}

export function BiologyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M4 14.899A7 7 0 1 1 15 9.101" />
      <path d="M15 9.101A7 7 0 1 1 4 14.899" />
    </svg>
  );
}

export function MathIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M5 12h14" />
      <path d="M5 7h14" />
      <path d="M10 4v16" />
      <path d="M16 4v16" />
    </svg>
  );
}
