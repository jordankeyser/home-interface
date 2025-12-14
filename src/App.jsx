import React, { useState } from 'react';
import { SettingsProvider } from './context/SettingsContext';
import Layout from './components/Layout';
import ClockBar from './components/ClockBar';
import TrainModule from './components/modules/Train/TrainModule';
import WeatherModule from './components/modules/Weather/WeatherModule';
import SleepMode from './components/SleepMode';

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <SettingsProvider>
      <SleepMode>
        <Layout isSettingsOpen={isSettingsOpen} setIsSettingsOpen={setIsSettingsOpen}>
          {/* Left Column: ClockBar + Weather Stacked */}
          <div className="flex flex-col gap-4 h-full min-h-0 overflow-visible">
            <ClockBar onSettingsClick={() => setIsSettingsOpen(true)} />
            <div className="flex-1 min-h-0 overflow-visible">
              <WeatherModule />
            </div>
          </div>

          {/* Right Column: Train Full Height */}
          <div className="h-full min-h-0 overflow-visible">
            <TrainModule />
          </div>
        </Layout>
      </SleepMode>
    </SettingsProvider>
  );
}

export default App;
