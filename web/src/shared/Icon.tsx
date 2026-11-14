const THERMOMETER = 'M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z';
const CLOUD = 'M7 16a4 4 0 0 1 .5-8A5 5 0 0 1 17 9a3.5 3.5 0 0 1 0 7z';
const WAVE = 'M3 19c3-2 5-2 8 0s5 2 8 0';

const PATHS: Record<string, string[]> = {
  T2M: [THERMOMETER],
  T2M_MAX: [THERMOMETER, 'M18 8l2.5-2.5L23 8M20.5 5.5V12'],
  T2M_MIN: [THERMOMETER, 'M18 10l2.5 2.5L23 10M20.5 12.5V6'],
  PRECTOTCORR: [CLOUD, 'M9 19l-1 2M13 19l-1 2M17 19l-1 2'],
  RH2M: ['M3 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0', 'M3 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0', 'M3 19c2-2 4-2 6 0s4 2 6 0 4-2 6 0'],
  WS2M: ['M3 8h11a3 3 0 1 0-3-3', 'M3 12h15a3 3 0 1 1-3 3', 'M3 16h7'],
  ALLSKY_SFC_SW_DWN: [
    'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
    'M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  ],
  IMERG_RAIN: ['M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z'],
  AOD: ['M4 7h12', 'M2 11h16', 'M6 15h14', 'M4 19h10'],
  SOIL_MOISTURE: ['M3 12h18M3 16h18M3 20h18', 'M12 2.5s2.5 2.6 2.5 4.3a2.5 2.5 0 0 1-5 0c0-1.7 2.5-4.3 2.5-4.3z'],
  RUNOFF: [WAVE, 'M12 3v10M8 9l4 4 4-4'],
  EVAPOTRANSPIRATION: [WAVE, 'M8 14V6M5 9l3-3 3 3', 'M16 14V6M13 9l3-3 3 3'],
  satellite: ['M9 9h6v6H9z', 'M2 10h5v4H2zM17 10h5v4h-5z', 'M7 12h2M15 12h2'],
};

interface IconProps {
  name: string;
  size?: number;
}

export function Icon({ name, size = 20 }: IconProps) {
  const paths = PATHS[name] ?? PATHS.satellite;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
