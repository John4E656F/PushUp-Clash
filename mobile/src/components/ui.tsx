import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radius, spacing } from '@/theme/theme';

export function Screen({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ children, style }: { children: ReactNode; style?: TextStyle }) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

export function Subtitle({ children, style }: { children: ReactNode; style?: TextStyle }) {
  return <Text style={[styles.subtitle, style]}>{children}</Text>;
}

export function Button({
  title,
  onPress,
  loading,
  variant = 'primary',
  disabled,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
}) {
  const bg =
    variant === 'primary' ? colors.primary : variant === 'danger' ? colors.danger : 'transparent';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        variant === 'ghost' && styles.buttonGhost,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <Text style={[styles.buttonText, variant === 'ghost' && { color: colors.primary }]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillValue}>{value}</Text>
      <Text style={styles.pillLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  subtitle: { color: colors.textDim, fontSize: 14 },
  button: {
    borderRadius: radius.pill,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonGhost: { borderWidth: 1, borderColor: colors.primary },
  buttonText: { color: colors.text, fontWeight: '700', fontSize: 16 },
  pill: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    flex: 1,
  },
  pillValue: { color: colors.text, fontSize: 22, fontWeight: '800' },
  pillLabel: { color: colors.textDim, fontSize: 12, marginTop: 2 },
});
