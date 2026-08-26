type P = { className?: string };

const base = 'h-4 w-4';

export const IconGrid = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

export const IconTable = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 9h18M9 9v11" />
  </svg>
);

export const IconSearch = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" strokeLinecap="round" />
  </svg>
);

export const IconChevronLeft = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="m15 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconChevronRight = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconLock = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 1 1 8 0v3" />
  </svg>
);

export const IconUpload = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M12 16V4m0 0L8 8m4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" />
  </svg>
);

export const IconBuilding = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" strokeLinecap="round" />
  </svg>
);

export const IconHistory = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M3 12a9 9 0 1 0 3-6.7" strokeLinecap="round" />
    <path d="M3 4v4h4M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconSliders = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
    <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />
    <circle cx="8" cy="18" r="2" fill="currentColor" stroke="none" />
  </svg>
);

export const IconCheck = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className={className}>
    <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconAlert = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M12 9v4m0 3h.01" strokeLinecap="round" />
    <path d="M10.3 3.9 2.5 17.4A2 2 0 0 0 4.2 20.4h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
  </svg>
);

export const IconLogout = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M15 12H4m0 0 3.5-3.5M4 12l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M11 5h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-6" strokeLinecap="round" />
  </svg>
);

export const IconDots = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <circle cx="5" cy="12" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="19" cy="12" r="1.8" />
  </svg>
);
