import React from 'react';
import StartupSplash from './StartupSplash';

function RealApplication() {
  return (
    <main style={{ minHeight: '100dvh', background: '#f7f8fb' }}>
      {/* 这里替换成你的真实 Windows 桌面应用界面。它会在动画开始前完成渲染。 */}
    </main>
  );
}

export default function App() {
  return (
    <>
      <RealApplication />
      <StartupSplash oncePerSession onComplete={() => console.info('Startup animation complete')} />
    </>
  );
}

