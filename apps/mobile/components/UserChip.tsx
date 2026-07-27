import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Avatar } from './Avatar';

type Props = {
  userId: string;
  /** Public name (nick). Rendered with an "@" prefix. */
  name: string | null | undefined;
  avatarUrl: string | null | undefined;
  size?: number;
  /** Optional secondary line (e.g. "Primer verificador"). */
  subtitle?: string | null;
  /** Runs before navigating (e.g. to close a modal). */
  onPress?: () => void;
};

/**
 * Tappable user identity: avatar + @nick. Navigates to the public profile.
 * Falls back to a non-interactive chip when the author is unknown.
 */
export function UserChip({ userId, name, avatarUrl, size = 32, subtitle, onPress }: Props) {
  const router = useRouter();
  const label = name?.trim() || 'Motero anónimo';

  const handlePress = useCallback(() => {
    onPress?.();
    if (userId) router.push(`/user/${userId}`);
  }, [router, userId, onPress]);

  const content = (
    <View className="flex-row items-center gap-2">
      <Avatar url={avatarUrl} name={label} size={size} />
      <View className="shrink">
        <Text className="text-content font-semibold text-sm" numberOfLines={1}>
          @{label}
        </Text>
        {subtitle ? (
          <Text className="text-content-muted text-xs" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );

  if (!userId) {
    return <View>{content}</View>;
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Ver perfil de ${label}`}
    >
      {content}
    </TouchableOpacity>
  );
}
