import { useState } from 'react';
import SettingsModal from './SettingsModal';
import { useSettings } from '../hooks/useSettings';

/**
 * Ambient background: three slow-drifting colour fields over the canvas.
 * The classes these used to rely on (`animate-blob`, `animation-delay-2000`)
 * were never defined anywhere, so the background was completely static.
 */
const Ambience = () => (
  <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
    <div
      className="absolute -top-1/4 -left-1/5 h-[70%] w-[70%] animate-drift-a rounded-full blur-[120px]"
      style={{
        background:
          'radial-gradient(circle, rgb(var(--glow-a) / var(--glow-strength)) 0%, transparent 70%)',
      }}
    />
    <div
      className="absolute -top-1/5 -right-1/4 h-[65%] w-[65%] animate-drift-b rounded-full blur-[120px]"
      style={{
        background:
          'radial-gradient(circle, rgb(var(--glow-b) / var(--glow-strength)) 0%, transparent 70%)',
      }}
    />
    <div
      className="absolute -bottom-1/3 left-1/4 h-[70%] w-[70%] animate-drift-c rounded-full blur-[120px]"
      style={{
        background:
          'radial-gradient(circle, rgb(var(--glow-c) / var(--glow-strength)) 0%, transparent 70%)',
      }}
    />
  </div>
);

const Layout = ({ children, isSettingsOpen, setIsSettingsOpen }) => {
  const [localOpen, setLocalOpen] = useState(false);
  const { settings } = useSettings();

  const isPiMode = settings.isPiMode;
  const settingsOpen = isSettingsOpen ?? localOpen;
  const setSettingsOpen = setIsSettingsOpen || setLocalOpen;

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-canvas text-fg">
      {/* In Pi mode, frame a 1024x600 viewport so the real panel can be
          previewed from a desktop browser. */}
      <div
        className={
          isPiMode
            ? 'relative h-[600px] w-[1024px] overflow-hidden rounded-2xl border-8 border-neutral-800 bg-canvas shadow-2xl'
            : 'relative h-full w-full overflow-hidden'
        }
      >
        <div
          className="absolute inset-0 bg-canvas"
          style={{
            backgroundImage:
              'radial-gradient(120% 90% at 50% 0%, var(--canvas-2) 0%, var(--canvas) 62%)',
          }}
        />
        <Ambience />

        {/* animate-shift creeps the whole panel ~2px over 15 minutes so an
            always-on wall display never holds one pixel value all day. */}
        <main className="relative z-10 h-full w-full animate-shift p-4">
          <div className="mx-auto grid h-full min-h-0 w-full max-w-[1500px] grid-cols-1 gap-4 md:grid-cols-[42%_58%]">
            {children}
          </div>
        </main>
      </div>

      {/* Mounted only while open, so its form state initialises from settings
          each time instead of needing a setState-in-effect sync. */}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
};

export default Layout;
