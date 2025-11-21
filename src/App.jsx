import React, { useState } from 'react';
import { SettingsProvider } from './context/SettingsContext';
import Layout from './components/Layout';
import ClockBar from './components/ClockBar';
import TrainModule from './components/modules/Train/TrainModule';
import WeatherModule from './components/modules/Weather/WeatherModule';

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <SettingsProvider>
      <Layout isSettingsOpen={isSettingsOpen} setIsSettingsOpen={setIsSettingsOpen}>
        {/* Left Column: ClockBar + Weather Stacked */}
        <div className="flex flex-col gap-1 h-full overflow-hidden">
          <ClockBar onSettingsClick={() => setIsSettingsOpen(true)} />
          <div className="flex-1 overflow-hidden">
            <WeatherModule />
          </div>
        </div>

        {/* Right Column: Train Full Height */}
        <div className="h-full overflow-hidden">
          <TrainModule />
        </div>
      </Layout>
    </SettingsProvider>
  );
}

export default App;
