/**
 * Ambient weather effects.
 *
 * CSS shapes only — no emoji, and no `Math.random()` at render time (the old
 * version reshuffled every droplet on every re-render). Offsets are derived
 * from the index so the field is stable across renders.
 */

const seeded = (i, mod, offset = 0) => ((i * 37 + offset) % mod) / mod;

const Rain = ({ heavy = false }) => {
  const count = heavy ? 26 : 16;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="absolute top-0 w-px rounded-full bg-gradient-to-b from-transparent via-sky-300/50 to-transparent"
          style={{
            left: `${seeded(i, 97) * 100}%`,
            height: heavy ? '22%' : '16%',
            animation: `rain-fall ${(heavy ? 0.7 : 1.1) + seeded(i, 53, 7) * 0.5}s linear infinite`,
            animationDelay: `${seeded(i, 71, 3) * 1.4}s`,
          }}
        />
      ))}
    </div>
  );
};

const Snow = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden">
    {Array.from({ length: 22 }, (_, i) => (
      <span
        key={i}
        className="absolute top-0 rounded-full bg-white/60"
        style={{
          left: `${seeded(i, 89) * 100}%`,
          height: `${3 + seeded(i, 31, 5) * 3}px`,
          width: `${3 + seeded(i, 31, 5) * 3}px`,
          animation: `snow-fall ${5 + seeded(i, 47, 11) * 4}s linear infinite`,
          animationDelay: `${seeded(i, 67, 2) * 5}s`,
        }}
      />
    ))}
  </div>
);

const Clouds = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden">
    {[
      { top: '12%', size: '46%', dur: '58s', delay: '0s', opacity: 0.1 },
      { top: '34%', size: '34%', dur: '74s', delay: '-22s', opacity: 0.07 },
      { top: '6%', size: '56%', dur: '92s', delay: '-48s', opacity: 0.05 },
    ].map((c, i) => (
      <span
        key={i}
        className="absolute rounded-[50%] bg-white blur-2xl"
        style={{
          top: c.top,
          left: '-20%',
          width: c.size,
          height: `calc(${c.size} * 0.42)`,
          opacity: c.opacity,
          animation: `cloud-drift ${c.dur} linear infinite`,
          animationDelay: c.delay,
        }}
      />
    ))}
  </div>
);

const Sun = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden">
    <span
      className="absolute -top-[18%] -right-[18%] h-[70%] w-[70%] rounded-full blur-[90px]"
      style={{
        background:
          'radial-gradient(circle, rgb(253 224 71 / 0.35) 0%, transparent 68%)',
        animation: 'sun-pulse 9s ease-in-out infinite',
      }}
    />
  </div>
);

const Fog = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden">
    {[28, 48, 68].map((top, i) => (
      <span
        key={top}
        className="absolute left-[-20%] h-[14%] w-[140%] bg-white/8 blur-2xl"
        style={{
          top: `${top}%`,
          animation: `cloud-drift ${70 + i * 18}s linear infinite`,
          animationDelay: `${i * -20}s`,
        }}
      />
    ))}
  </div>
);

const Storm = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden">
    <Rain heavy />
    <span
      className="absolute inset-0 bg-white"
      style={{ animation: 'flash 7s linear infinite' }}
    />
  </div>
);

const WeatherBackdrop = ({ code, isDay = true }) => {
  if (code === 0 || code === 1) return isDay ? <Sun /> : null;
  if (code === 2 || code === 3) return <Clouds />;
  if (code === 45 || code === 48) return <Fog />;
  if (code >= 95) return <Storm />;
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return <Snow />;
  if (code >= 51 && code <= 67) return <Rain heavy={code >= 63} />;
  if (code >= 80 && code <= 82) return <Rain heavy />;
  return null;
};

export default WeatherBackdrop;
