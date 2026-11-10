import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSession } from '@/entities/session';

type Props = { onSignedIn: () => void };

export function LoginScreen({ onSignedIn }: Props) {
  const signIn = useSession((s) => s.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    setPending(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      onSignedIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось войти');
    } finally {
      setPending(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.eyebrow}>ПРИЗНАКИ БЕШЕНСТВА 24</Text>
      <Text style={styles.title}>Вход в штаб</Text>
      <TextInput
        style={styles.input}
        placeholder="Почта"
        placeholderTextColor="#6f6a7d"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Пароль"
        placeholderTextColor="#6f6a7d"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.button} onPress={submit} disabled={pending}>
        {pending ? <ActivityIndicator color="#0b0b0f" /> : <Text style={styles.buttonText}>Войти</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b0f', justifyContent: 'center', paddingHorizontal: 24, gap: 12 },
  eyebrow: { color: '#a78bfa', fontSize: 11, letterSpacing: 1.2, fontWeight: '600' },
  title: { color: '#f4f1fa', fontSize: 26, fontWeight: '700', marginBottom: 8 },
  input: {
    backgroundColor: '#15151a',
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f4f1fa',
  },
  button: { backgroundColor: '#a78bfa', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  buttonText: { color: '#0b0b0f', fontWeight: '700', fontSize: 14 },
  error: { color: '#f87171', fontSize: 12.5 },
});
