import { NextConfig } from 'next';

const config: NextConfig = {
  // ... existing code ...

  // Улучшенное отображение ошибок
  onError: (err: Error) => {
    console.error('🔴 Ошибка сборки:');
    console.error(err.stack);
  },
  
  // Включаем подробный вывод ошибок в development
  typescript: {
    ignoreBuildErrors: false,
    tsconfigPath: './tsconfig.json'
  },

  // Включаем экспериментальные фичи для лучшего дебага
  experimental: {
    // ... existing experimental options ...
    
    // Разрешаем development сборку для отладки
    allowDevelopmentBuild: process.env.NODE_ENV === 'development',
    
    // Улучшенное отображение ошибок в Fast Refresh
    optimizeFonts: true,
    scrollRestoration: true,
    
    // Включаем улучшенный оверлей ошибок
    webVitalsAttribution: ['CLS', 'LCP', 'FID', 'INP', 'TTFB'],
  },

  // Включаем подробный вывод в консоль
  logging: {
    level: 'verbose',
    fullUrl: true
  }
};

export default config; 