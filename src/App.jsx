import { useState } from 'react';
import { SettingsProvider } from './context/SettingsContext';
import SleepMode from './components/SleepMode';
import Layout from './components/Layout';
import ClockBar from './components/ClockBar';
import WeatherModule from './components/modules/Weather/WeatherModule';
import TrainModule from './components/modules/Train/TrainModule';
import StocksModule from './components/modules/Stocks/StocksModule';

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <SettingsProvider>
      {/* SleepMode sits above Layout so every module can read sleep state and
          pause its polling, and so the sleep overlay covers the whole panel. */}
      <SleepMode>
        <Layout isSettingsOpen={isSettingsOpen} setIsSettingsOpen={setIsSettingsOpen}>
          {/* Left: clock over weather */}
          <div className="flex h-full min-h-0 min-w-0 flex-col gap-4">
            <ClockBar onSettingsClick={() => setIsSettingsOpen(true)} />
            <div className="min-h-0 min-w-0 flex-1">
              <WeatherModule />
            </div>
          </div>

          {/* Right: arrivals over the market ticker */}
          <div className="flex h-full min-h-0 min-w-0 flex-col gap-4">
            <div className="min-h-0 min-w-0 flex-1">
              <TrainModule />
            </div>
            <div className="h-[76px] shrink-0 min-w-0">
              <StocksModule />
            </div>
          </div>
        </Layout>
      </SleepMode>
    </SettingsProvider>
  );
}

export default App;
