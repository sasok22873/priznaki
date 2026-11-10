import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootScreen } from './src/app/RootScreen';

export default function App() {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } }),
  );
  return (
    <QueryClientProvider client={client}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <RootScreen />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
