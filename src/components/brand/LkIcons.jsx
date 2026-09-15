// LOKIN AI — Brand icon set, ported 1:1 from the design system's Icons section.
// Single-weight outline glyphs that inherit the parent's text color via
// currentColor, so active items render in primary green and inactive ones in
// muted grey (brand rule 6).

function LkIcon({ size = 24, className = "", children, ...rest }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

/* Icons · Navigation */
export function LkNavDelivery(props) {
  return (
    <LkIcon {...props}>
      <path d="M2 7h9v9H2z" />
      <path d="M11 10h4l3 3v3h-7z" />
      <circle cx="6" cy="18" r="1.6" />
      <circle cx="16" cy="18" r="1.6" />
    </LkIcon>
  );
}

export function LkNavRoute(props) {
  return (
    <LkIcon {...props}>
      <circle cx="6" cy="6" r="2.4" />
      <circle cx="18" cy="18" r="2.4" />
      <path d="M8.4 6h6.1a3.5 3.5 0 0 1 0 7H9.5a3.5 3.5 0 0 0 0 7h6.1" />
    </LkIcon>
  );
}

export function LkNavEarnings(props) {
  return (
    <LkIcon {...props}>
      <path d="M4 20V11" />
      <path d="M9.3 20V5" />
      <path d="M14.7 20V9" />
      <path d="M20 20V7" />
    </LkIcon>
  );
}

export function LkNavMore(props) {
  return (
    <LkIcon {...props}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </LkIcon>
  );
}

/* Icons · Actions */
export function LkIconLockIn(props) {
  return (
    <LkIcon {...props}>
      <rect x="4.5" y="10" width="15" height="10" rx="3" />
      <path d="M8.2 10V7.6a3.8 3.8 0 0 1 7.6 0V10" />
      <path d="M12 13.6v2.8" />
    </LkIcon>
  );
}

export function LkIconVoice(props) {
  return (
    <LkIcon {...props}>
      <rect x="9.2" y="3" width="5.6" height="10" rx="2.8" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <path d="M12 17.5V21" />
    </LkIcon>
  );
}

export function LkIconNavigate(props) {
  return (
    <LkIcon {...props}>
      <path d="M12 21s6.4-6.1 6.4-10.6A6.4 6.4 0 0 0 5.6 10.4C5.6 14.9 12 21 12 21z" />
      <circle cx="12" cy="10.2" r="2.3" />
    </LkIcon>
  );
}

export function LkIconAiInsight(props) {
  return (
    <LkIcon {...props}>
      <path d="M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9z" />
      <path d="M18 16.2l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
    </LkIcon>
  );
}

/* Icons · Status */
export function LkIconOnline(props) {
  return (
    <LkIcon {...props}>
      <path d="M5 18V13" />
      <path d="M9.7 18v-7.5" />
      <path d="M14.3 18V8" />
      <path d="M19 18V5.5" />
    </LkIcon>
  );
}

export function LkIconSafety(props) {
  return (
    <LkIcon {...props}>
      <path d="M12 3l7 3v5.5c0 4.4-3 8-7 9.5-4-1.5-7-5.1-7-9.5V6z" />
      <path d="M8.8 12.1l2.2 2.2 4.2-4.4" />
    </LkIcon>
  );
}

export function LkIconGoalTime(props) {
  return (
    <LkIcon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.4V12l3.4 2" />
    </LkIcon>
  );
}

export function LkIconTapOut(props) {
  return (
    <LkIcon {...props}>
      <path d="M12 3v7" />
      <path d="M6.6 6.8a8 8 0 1 0 10.8 0" />
    </LkIcon>
  );
}