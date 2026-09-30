import { useState } from 'react';
import { SettingsProvider } from './context/SettingsContext';
import SleepMode from './components/SleepMode';
import Layout from './components/Layout';
import Pager from './components/Pager';
import ClockBar from './components/ClockBar';
import WeatherModule from './components/modules/Weather/WeatherModule';
import TrainModule from './components/modules/Train/TrainModule';
import DevicesModule from './components/modules/Devices/DevicesModule';

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const openSettings = () => setIsSettingsOpen(true);

  return (
    <SettingsProvider>
      {/* SleepMode sits above Layout so every module can read sleep state and
          pause its polling, and so the sleep overlay covers the whole panel. */}
      <SleepMode>
        <Layout isSettingsOpen={isSettingsOpen} setIsSettingsOpen={setIsSettingsOpen}>
          <Pager>
            {/* Page 1: clock over weather, arrivals down the right */}
            <div
              key="home"
              className="mx-auto grid h-full min-h-0 w-full max-w-[1500px] grid-cols-1 gap-4 md:grid-cols-[42%_58%]"
            >
              <div className="flex h-full min-h-0 min-w-0 flex-col gap-4">
                <ClockBar onSettingsClick={openSettings} />
                <div className="min-h-0 min-w-0 flex-1">
                  <WeatherModule />
                </div>
              </div>
              <div className="h-full min-h-0 min-w-0">
                <TrainModule />
              </div>
            </div>

            {/* Page 2: smart-home devices */}
            <DevicesModule key="devices" onSettingsClick={openSettings} />
          </Pager>
        </Layout>
      </SleepMode>
    </SettingsProvider>
  );
}

export default App;
