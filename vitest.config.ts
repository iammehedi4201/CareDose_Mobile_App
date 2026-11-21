import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'react-native': path.resolve(__dirname, 'src/test/mocks/react-native.ts'),
      '@expo/vector-icons': path.resolve(__dirname, 'src/test/mocks/expo-vector-icons.ts'),
      'expo-constants': path.resolve(__dirname, 'src/test/mocks/expo-constants.ts'),
      '@react-native-community/datetimepicker': path.resolve(
        __dirname,
        'src/test/mocks/datetimepicker.ts',
      ),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**'],
    },
  },
});
