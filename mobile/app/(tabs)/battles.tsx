import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi } from '@/api/useApi';
import type { Battle } from '@/api/client';
import { Button, Card, Subtitle, Title } from '@/components/ui';
import { colors, radius, spacing } from '@/theme/theme';

const STATUS_LABEL: Record<Battle['status'], string> = {
  pending: 'Waiting for opponent',
  active: 'In progress',
  complete: 'Finished',
};

export default function Battles() {
  const api = useApi();
  const insets = useSafeAreaInsets();
  const [battles, setBattles] = useState<Battle[]>([]);

  const load = useCallback(() => {
    api
      .listBattles()
      .then((r) => setBattles(r.battles))
      .catch((e) => console.warn('battles failed', e));
  }, [api]);

  useFocusEffect(useCallback(() => load(), [load]));

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <Title>⚔️ Battles</Title>
      <Subtitle>Challenge a friend to a pushup duel</Subtitle>

      <Card style={{ marginTop: spacing.md, gap: spacing.sm }}>
        <Text style={styles.label}>NEW BATTLE</Text>
        <Subtitle>
          Pick an opponent from the leaderboard and throw down. (Opponent search UI is the next
          milestone — the API is ready.)
        </Subtitle>
        <Button title="Find an opponent" variant="ghost" onPress={() => {}} />
      </Card>

      <FlatList
        style={{ marginTop: spacing.md }}
        data={battles}
        keyExtractor={(b) => b.id}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={<Subtitle>No battles yet. Start one above!</Subtitle>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>Duel · target {item.targetReps} reps</Text>
              <Text style={styles.meta}>{STATUS_LABEL[item.status]}</Text>
            </View>
            <Text style={styles.score}>
              {item.entries.map((e) => e.reps).join(' – ')}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  label: { color: colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  score: { color: colors.primary, fontWeight: '900', fontSize: 18 },
});
