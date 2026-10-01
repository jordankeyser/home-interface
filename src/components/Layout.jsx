import { useState } from 'react';
import SettingsModal from './SettingsModal';
import { useSettings } from '../hooks/useSettings';

const Layout = ({ children, isSettingsOpen, setIsSettingsOpen }) => {
  const [localOpen, setLocalOpen] = useState(false);
  const { settings } = useSettings();

  // Preview framing is desktop-only. A saved preview setting must never add a
  // second frame around the real kiosk viewport.
  const isPiMode =
    settings.isPiMode && import.meta.env.VITE_HOME_INTERFACE_KIOSK !== '1';
  const settingsOpen = isSettingsOpen ?? localOpen;
  const setSettingsOpen = setIsSettingsOpen || setLocalOpen;

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-canvas text-fg">
      {/* In Pi mode, frame the actual 800x480 viewport so the real panel can be
          previewed from a desktop browser. */}
      <div
        className={
          isPiMode
            ? 'relative h-[480px] w-[800px] overflow-hidden rounded-2xl border-8 border-neutral-800 bg-canvas shadow-2xl'
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
        {/* animate-shift creeps the whole panel ~2px over 15 minutes so an
            always-on wall display never holds one pixel value all day.
            Pages bring their own padding so swiping moves them edge to edge. */}
        <main className="relative z-10 h-full w-full animate-shift">{children}</main>
      </div>

      {/* Mounted only while open, so its form state initialises from settings
          each time instead of needing a setState-in-effect sync. */}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
};

export default Layout;
