import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useKeycloakAuth } from '@/features/auth';

export function LoginScreen() {
  const { ready, pending, error, signIn } = useKeycloakAuth();

  return (
    <View style={styles.root}>
      <Text style={styles.eyebrow}>ПРИЗНАКИ БЕШЕНСТВА 24</Text>
      <Text style={styles.title}>Вход в штаб</Text>
      <Text style={styles.subtitle}>Авторизация через Keycloak. Учётную запись выдаёт владелец штаба.</Text>
      <Pressable style={[styles.button, (!ready || pending) && styles.buttonDisabled]} onPress={signIn} disabled={!ready || pending}>
        {pending ? <ActivityIndicator color="#0b0b0f" /> : <Text style={styles.buttonText}>Войти через Keycloak</Text>}
      </Pressable>
      {!ready ? (
        <View style={styles.row}>
          <ActivityIndicator color="#a78bfa" />
          <Text style={styles.hint}>Подключаемся к серверу авторизации…</Text>
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b0f', justifyContent: 'center', paddingHorizontal: 24, gap: 12 },
  eyebrow: { color: '#a78bfa', fontSize: 11, letterSpacing: 1.2, fontWeight: '600' },
  title: { color: '#f4f1fa', fontSize: 26, fontWeight: '700' },
  subtitle: { color: '#8f8a9c', fontSize: 12.5, lineHeight: 18, marginBottom: 8 },
  button: { backgroundColor: '#a78bfa', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#0b0b0f', fontWeight: '700', fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hint: { color: '#6f6a7d', fontSize: 12 },
  error: { color: '#f87171', fontSize: 12.5 },
});
