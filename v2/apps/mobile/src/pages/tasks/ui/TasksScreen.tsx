import { ActivityIndicator, FlatList, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { useMoveTask, useTasks, type Task } from '@/entities/task';
import { short } from '@/shared/lib/date';

const STATUSES: Array<{ key: Task['status']; title: string }> = [
  { key: 'planned', title: 'Запланирована' },
  { key: 'in_progress', title: 'В работе' },
  { key: 'done', title: 'Завершена' },
];

export function TasksScreen({ onSignOut }: { onSignOut: () => void }) {
  const { data, isLoading, error } = useTasks();
  const move = useMoveTask();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#a78bfa" />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{(error as Error).message}</Text>
      </View>
    );
  }

  const sections = STATUSES.map((status) => ({
    title: status.title,
    data: (data ?? []).filter((t) => t.status === status.key),
  }));

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>ИСПОЛНЕНИЕ</Text>
          <Text style={styles.title}>Задачи</Text>
        </View>
        <Pressable onPress={onSignOut}>
          <Text style={styles.link}>Выйти</Text>
        </Pressable>
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle}>
            {section.title} · {section.data.length}
          </Text>
        )}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardMeta}>
              {short(item.dueDate)} {item.goal ? `· ◎ ${item.goal}` : ''}
            </Text>
            <View style={styles.actions}>
              {item.status !== 'in_progress' ? (
                <Pressable style={styles.smallBtn} onPress={() => move.mutate({ id: item.id, status: 'in_progress' })}>
                  <Text style={styles.smallBtnText}>В работу</Text>
                </Pressable>
              ) : null}
              {item.status !== 'done' ? (
                <Pressable style={styles.smallBtn} onPress={() => move.mutate({ id: item.id, status: 'done' })}>
                  <Text style={styles.smallBtnText}>Готово</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.cardMeta}>Задач пока нет</Text>}
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b0f', paddingHorizontal: 16, paddingTop: 12 },
  center: { flex: 1, backgroundColor: '#0b0b0f', alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12 },
  eyebrow: { color: '#a78bfa', fontSize: 10.5, letterSpacing: 1.1, fontWeight: '600' },
  title: { color: '#f4f1fa', fontSize: 24, fontWeight: '700' },
  link: { color: '#a78bfa', fontSize: 13 },
  sectionTitle: { color: '#a8a3b3', fontSize: 12, marginTop: 14, marginBottom: 6, fontWeight: '600' },
  card: { backgroundColor: '#15151a', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 8, gap: 6 },
  cardTitle: { color: '#efeaf8', fontSize: 14, fontWeight: '600' },
  cardMeta: { color: '#8f8a9c', fontSize: 11.5 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 2 },
  smallBtn: { borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 5 },
  smallBtnText: { color: '#d8d2e6', fontSize: 11.5 },
  error: { color: '#f87171', fontSize: 13, paddingHorizontal: 20, textAlign: 'center' },
});
