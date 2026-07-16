import { Text, TextInput, View, type TextInputProps, type ViewProps } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, fontSize, radius, spacing } from '@/theme/tokens';

// ─── Label ───────────────────────────────────────────────────
interface LabelProps {
  children: React.ReactNode;
  required?: boolean;
}
export function Label({ children, required }: LabelProps) {
  const { colors } = useTheme();
  return (
    <Text style={{ fontFamily: fontFamily.semibold, fontSize: fontSize.sm, color: colors.foregroundSecondary, marginBottom: spacing.xs, textAlign: 'right' }}>
      {children}
      {required && <Text style={{ color: colors.destructive }}> *</Text>}
    </Text>
  );
}

// ─── Input ───────────────────────────────────────────────────
interface InputProps extends TextInputProps {
  error?: string;
}
export function Input({ error, style, ...props }: InputProps) {
  const { colors } = useTheme();
  return (
    <View>
      <TextInput
        placeholderTextColor={colors.mutedForeground}
        textAlign="right"
        style={[
          {
            backgroundColor: colors.input,
            borderWidth: 1.5,
            borderColor: error ? colors.destructive : colors.border,
            borderRadius: radius.lg,
            paddingHorizontal: spacing.md,
            paddingVertical: 13,
            fontFamily: fontFamily.regular,
            fontSize: fontSize.md,
            color: colors.foreground,
          },
          style,
        ]}
        {...props}
      />
      {error && (
        <Text style={{ color: colors.destructive, fontSize: fontSize.xs, fontFamily: fontFamily.regular, marginTop: 4, textAlign: 'right' }}>
          {error}
        </Text>
      )}
    </View>
  );
}

// ─── Textarea ────────────────────────────────────────────────
interface TextareaProps extends TextInputProps {
  rows?: number;
  error?: string;
}
export function Textarea({ rows = 4, error, style, ...props }: TextareaProps) {
  const { colors } = useTheme();
  return (
    <View>
      <TextInput
        multiline
        textAlignVertical="top"
        textAlign="right"
        placeholderTextColor={colors.mutedForeground}
        style={[
          {
            backgroundColor: colors.input,
            borderWidth: 1.5,
            borderColor: error ? colors.destructive : colors.border,
            borderRadius: radius.lg,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.md,
            fontFamily: fontFamily.regular,
            fontSize: fontSize.md,
            color: colors.foreground,
            minHeight: rows * 24,
          },
          style,
        ]}
        {...props}
      />
      {error && (
        <Text style={{ color: colors.destructive, fontSize: fontSize.xs, fontFamily: fontFamily.regular, marginTop: 4, textAlign: 'right' }}>
          {error}
        </Text>
      )}
    </View>
  );
}

// ─── Badge ───────────────────────────────────────────────────
type BadgeTone = 'primary' | 'success' | 'warning' | 'destructive' | 'muted' | 'info';
interface BadgeProps {
  children: React.ReactNode;
  tone?: BadgeTone;
  size?: 'sm' | 'md';
}
export function Badge({ children, tone = 'muted', size = 'md' }: BadgeProps) {
  const { colors } = useTheme();
  const toneMap: Record<BadgeTone, { bg: string; text: string }> = {
    primary: { bg: colors.primarySubtle, text: colors.primary },
    success: { bg: colors.successSubtle, text: colors.success },
    warning: { bg: colors.warningSubtle, text: colors.warning },
    destructive: { bg: colors.destructiveSubtle, text: colors.destructive },
    muted: { bg: colors.muted, text: colors.mutedForeground },
    info: { bg: colors.infoSubtle, text: colors.info },
  };
  const t = toneMap[tone];
  return (
    <View style={{ backgroundColor: t.bg, borderRadius: radius.full, paddingHorizontal: size === 'sm' ? 8 : 10, paddingVertical: size === 'sm' ? 2 : 4, alignSelf: 'flex-start' }}>
      <Text style={{ color: t.text, fontFamily: fontFamily.semibold, fontSize: size === 'sm' ? fontSize.xs : fontSize.sm }}>
        {children}
      </Text>
    </View>
  );
}

// ─── Divider ─────────────────────────────────────────────────
export function Divider({ label }: { label?: string }) {
  const { colors } = useTheme();
  if (label) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        <Text style={{ color: colors.mutedForeground, fontFamily: fontFamily.medium, fontSize: fontSize.xs }}>
          {label}
        </Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      </View>
    );
  }
  return <View style={{ height: 1, backgroundColor: colors.border }} />;
}

// ─── Chip ────────────────────────────────────────────────────
import { Pressable } from 'react-native';
interface ChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  size?: 'sm' | 'md';
}
export function Chip({ label, active = false, onPress, size = 'md' }: ChipProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: active ? colors.primary : colors.surface,
        borderWidth: 1.5,
        borderColor: active ? colors.primary : colors.border,
        borderRadius: radius.full,
        paddingHorizontal: size === 'sm' ? 12 : 16,
        paddingVertical: size === 'sm' ? 5 : 8,
        // ✔ Responsive fix: never allow this button to shrink below its content width
        flexShrink: 0,
        minHeight: size === 'sm' ? 30 : 38,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          color: active ? colors.primaryForeground : colors.foreground,
          fontFamily: active ? fontFamily.semibold : fontFamily.medium,
          fontSize: size === 'sm' ? fontSize.xs : fontSize.sm,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
