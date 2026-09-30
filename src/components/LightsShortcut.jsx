import { useContext } from 'react';
import { useHomeAssistant } from '../hooks/useHomeAssistant';
import { PagerContext } from '../context/pagerStore';
import { isLight, isOn } from '../lib/haEntities';
import { BulbIcon } from './icons';

/** Index of the devices page in App's Pager. */
const DEVICES_PAGE = 1;

/**
 * "3 lights on" on the home page: answers "did I leave a light on?" without
 * leaving the trains, and is a visible way onto the devices page for anyone
 * who doesn't know to swipe.
 */
const LightsShortcut = ({ className = '' }) => {
  const { configured, loaded, groups } = useHomeAssistant();
  const { goTo } = useContext(PagerContext);

  if (!configured) return null;

  const lights = groups.flatMap((g) => g.entities).filter(isLight);
  const onCount = lights.filter(isOn).length;
  const lit = loaded && onCount > 0;
  const label = !loaded ? 'Home' : lit ? `${onCount} on` : 'Lights off';

  return (
    <button
      type="button"
      onClick={() => goTo(DEVICES_PAGE)}
      className={`btn px-4 ${className}`}
      style={
        lit
          ? {
              backgroundColor: 'color-mix(in srgb, var(--lamp) 18%, var(--surface))',
              borderColor: 'color-mix(in srgb, var(--lamp) 45%, transparent)',
            }
          : undefined
      }
      aria-label={loaded ? `Lights: ${label}. Open home controls` : 'Open home controls'}
    >
      <BulbIcon className="h-5 w-5" style={{ color: lit ? 'var(--lamp)' : 'var(--fg-muted)' }} />
      <span className="nums">{label}</span>
    </button>
  );
};

export default LightsShortcut;
