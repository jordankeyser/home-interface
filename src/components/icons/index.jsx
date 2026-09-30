/**
 * Icon set.
 *
 * One consistent family: 24x24 viewBox, 1.75 stroke, round caps/joins, drawn on
 * `currentColor`. This replaces the emoji glyphs the dashboard used to render —
 * on Raspberry Pi OS those fall through to Noto Color Emoji, which is glossy,
 * inconsistently weighted, and the single biggest thing that made the panel read
 * as a prototype rather than an appliance.
 */

const Svg = ({ children, className = 'h-6 w-6', filled = false, ...rest }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    className={className}
    fill={filled ? 'currentColor' : 'none'}
    stroke={filled ? 'none' : 'currentColor'}
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    {...rest}
  >
    {children}
  </svg>
);

/* ---------------------------------------------------------------- weather -- */

export const SunIcon = (props) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="4.25" />
    <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" />
  </Svg>
);

export const MoonIcon = (props) => (
  <Svg {...props}>
    <path d="M20.4 14.6A8.6 8.6 0 0 1 9.4 3.6a8.6 8.6 0 1 0 11 11Z" />
  </Svg>
);

export const CloudIcon = (props) => (
  <Svg {...props}>
    <path d="M7.2 18.5h9.9a3.9 3.9 0 0 0 .5-7.77 5.6 5.6 0 0 0-10.83-1.4 3.9 3.9 0 0 0 .43 9.17Z" />
  </Svg>
);

export const PartlyCloudyIcon = (props) => (
  <Svg {...props}>
    <path d="M8 5.1V3.4M3.9 8.9H2.2M5.35 5.35 4.2 4.2M10.65 5.35 11.8 4.2" />
    <circle cx="8" cy="8.9" r="2.5" />
    <path d="M9.6 19.6h8.1a3.35 3.35 0 0 0 .4-6.68 4.85 4.85 0 0 0-9.32-1.2 3.35 3.35 0 0 0 .82 7.88Z" />
  </Svg>
);

export const RainIcon = (props) => (
  <Svg {...props}>
    <path d="M7.4 15.6h9.4a3.7 3.7 0 0 0 .5-7.37 5.35 5.35 0 0 0-10.35-1.34A3.7 3.7 0 0 0 7.4 15.6Z" />
    <path d="M8.6 18.6l-.9 2.4M12.2 18.6l-.9 2.4M15.8 18.6l-.9 2.4" />
  </Svg>
);

export const DrizzleIcon = (props) => (
  <Svg {...props}>
    <path d="M7.4 15.6h9.4a3.7 3.7 0 0 0 .5-7.37 5.35 5.35 0 0 0-10.35-1.34A3.7 3.7 0 0 0 7.4 15.6Z" />
    <path d="M9.4 18.8v1.4M12.8 18.8v1.4M16.2 18.8v1.4" />
  </Svg>
);

export const SnowIcon = (props) => (
  <Svg {...props}>
    <path d="M7.4 15.1h9.4a3.7 3.7 0 0 0 .5-7.37 5.35 5.35 0 0 0-10.35-1.34A3.7 3.7 0 0 0 7.4 15.1Z" />
    <path d="M9 18.2h.01M12 20.4h.01M15 18.2h.01M12 17.6h.01M9 21h.01M15 21h.01" />
  </Svg>
);

export const SleetIcon = (props) => (
  <Svg {...props}>
    <path d="M7.4 15.1h9.4a3.7 3.7 0 0 0 .5-7.37 5.35 5.35 0 0 0-10.35-1.34A3.7 3.7 0 0 0 7.4 15.1Z" />
    <path d="M9.2 18.1l-.8 2.1M15.2 18.1l-.8 2.1M12.2 18.4h.01M12.2 21h.01" />
  </Svg>
);

export const StormIcon = (props) => (
  <Svg {...props}>
    <path d="M7.4 14.6h9.4a3.7 3.7 0 0 0 .5-7.37 5.35 5.35 0 0 0-10.35-1.34A3.7 3.7 0 0 0 7.4 14.6Z" />
    <path d="M13.3 16.6l-3 4.1h2.6l-.9 2.9 3.2-4.4h-2.6Z" />
  </Svg>
);

export const FogIcon = (props) => (
  <Svg {...props}>
    <path d="M7.6 12.9h9a3.55 3.55 0 0 0 .48-7.07 5.15 5.15 0 0 0-9.96-1.29A3.55 3.55 0 0 0 7.6 12.9Z" />
    <path d="M4.6 16.4h14.8M6.6 19.6h10.8" />
  </Svg>
);

/* --------------------------------------------------------------- metrics -- */

export const WindIcon = (props) => (
  <Svg {...props}>
    <path d="M3.5 8.5h11a3 3 0 1 0-3-3M3.5 15.5h8.6a2.8 2.8 0 1 1-2.8 2.8M3.5 12h16" />
  </Svg>
);

export const HumidityIcon = (props) => (
  <Svg {...props}>
    <path d="M12 2.9s6 6.35 6 10.35a6 6 0 0 1-12 0C6 9.25 12 2.9 12 2.9Z" />
    <path d="M9.4 13.9a2.7 2.7 0 0 0 2.6 3" />
  </Svg>
);

export const PrecipIcon = (props) => (
  <Svg {...props}>
    <path d="M12 3.4 7.9 9.9a5 5 0 1 0 8.2 0L12 3.4Z" />
  </Svg>
);

export const ThermometerIcon = (props) => (
  <Svg {...props}>
    <path d="M14 14.8V5.4a2 2 0 1 0-4 0v9.4a3.6 3.6 0 1 0 4 0Z" />
  </Svg>
);

/* ------------------------------------------------------------------- ui --- */

export const SettingsIcon = (props) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.5 12a7.5 7.5 0 0 0-.12-1.32l2-1.5-2-3.46-2.32.98a7.5 7.5 0 0 0-2.29-1.33L14.4 3h-4l-.37 2.37a7.5 7.5 0 0 0-2.29 1.33L5.42 5.72l-2 3.46 2 1.5a7.5 7.5 0 0 0 0 2.64l-2 1.5 2 3.46 2.32-.98a7.5 7.5 0 0 0 2.29 1.33L10.4 21h4l.37-2.37a7.5 7.5 0 0 0 2.29-1.33l2.32.98 2-3.46-2-1.5A7.5 7.5 0 0 0 19.5 12Z" />
  </Svg>
);

export const RefreshIcon = (props) => (
  <Svg {...props}>
    <path d="M20.4 11.3a8.4 8.4 0 1 0-2.2 6.1" />
    <path d="M20.9 5.6v5.9h-5.9" />
  </Svg>
);

export const PauseIcon = (props) => (
  <Svg {...props}>
    <path d="M9.5 5.5v13M14.5 5.5v13" />
  </Svg>
);

export const PlayIcon = (props) => (
  <Svg {...props}>
    <path d="M8 5.2l11 6.8-11 6.8V5.2Z" />
  </Svg>
);

export const ChevronDownIcon = (props) => (
  <Svg {...props}>
    <path d="M5.5 9l6.5 6.5L18.5 9" />
  </Svg>
);

export const CloseIcon = (props) => (
  <Svg {...props}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);

export const CheckIcon = (props) => (
  <Svg {...props}>
    <path d="M4.5 12.8l5 5 10-11" />
  </Svg>
);

export const PowerIcon = (props) => (
  <Svg {...props}>
    <path d="M12 3.2v8.4" />
    <path d="M18 6.6a8.4 8.4 0 1 1-12 0" />
  </Svg>
);

export const ExitIcon = (props) => (
  <Svg {...props}>
    <path d="M15 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5H15" />
    <path d="M14.5 12H21M18 8.5 21 12l-3 3.5" />
  </Svg>
);

export const EyeIcon = (props) => (
  <Svg {...props}>
    <path d="M2.6 12S6.4 5.6 12 5.6 21.4 12 21.4 12 17.6 18.4 12 18.4 2.6 12 2.6 12Z" />
    <circle cx="12" cy="12" r="2.9" />
  </Svg>
);

export const EyeOffIcon = (props) => (
  <Svg {...props}>
    <path d="M9.6 5.9A9.4 9.4 0 0 1 12 5.6c5.6 0 9.4 6.4 9.4 6.4a16 16 0 0 1-3 3.8M6.4 7.9A16.5 16.5 0 0 0 2.6 12S6.4 18.4 12 18.4a9.3 9.3 0 0 0 3-.48" />
    <path d="M10.1 10.1a2.9 2.9 0 0 0 4 4M3.5 3.5l17 17" />
  </Svg>
);

export const TrainIcon = (props) => (
  <Svg {...props}>
    <rect x="5" y="3.4" width="14" height="13.2" rx="3.2" />
    <path d="M5 10.4h14M9.2 20.6l1.9-4M14.8 20.6l-1.9-4M7.4 20.6h9.2" />
    <path d="M9 13.6h.01M15 13.6h.01" />
  </Svg>
);

export const TrendUpIcon = (props) => (
  <Svg {...props} className={props.className || 'h-4 w-4'}>
    <path d="M4 16.5 10 10l3.5 3.5L20 7" />
    <path d="M14.6 7H20v5.4" />
  </Svg>
);

export const TrendDownIcon = (props) => (
  <Svg {...props} className={props.className || 'h-4 w-4'}>
    <path d="M4 7.5 10 14l3.5-3.5L20 17" />
    <path d="M14.6 17H20v-5.4" />
  </Svg>
);

export const WarningIcon = (props) => (
  <Svg {...props}>
    <path d="M12 4.2 2.9 19.8h18.2L12 4.2Z" />
    <path d="M12 10v4M12 17h.01" />
  </Svg>
);

export const OfflineIcon = (props) => (
  <Svg {...props}>
    <path d="M3.5 3.5l17 17" />
    <path d="M8.6 15.5a4.8 4.8 0 0 1 6.8 0M5.4 12.3a9.4 9.4 0 0 1 3-2M18.6 12.3a9.4 9.4 0 0 0-4.5-2.5M2.2 9.1a14 14 0 0 1 4-2.6M21.8 9.1a14 14 0 0 0-9.9-3.4" />
    <path d="M12 18.8h.01" />
  </Svg>
);
