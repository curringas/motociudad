import React from 'react';
import { View, Text, Image } from 'react-native';
import { supabase } from '@/lib/supabase';

type Props = {
  /** Stored avatar value: a full URL, or a path within the `avatars` bucket. */
  url: string | null | undefined;
  /** Used for the initial fallback when there is no image. */
  name: string | null | undefined;
  size?: number;
};

/** Resolves the stored avatar value to a displayable public URL. */
export function resolveAvatarUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return supabase.storage.from('avatars').getPublicUrl(url).data.publicUrl;
}

/** Circular avatar image with an initial fallback when there is no picture. */
export function Avatar({ url, name, size = 40 }: Props) {
  const resolved = resolveAvatarUrl(url);
  const initial = (name?.trim()?.charAt(0) ?? '?').toUpperCase();
  const dimensions = { width: size, height: size, borderRadius: size / 2 };

  if (resolved) {
    return (
      <Image
        source={{ uri: resolved }}
        style={dimensions}
        accessibilityLabel={name ? `Avatar de ${name}` : 'Avatar'}
      />
    );
  }

  return (
    <View
      className="bg-surface-2 items-center justify-center"
      style={dimensions}
      accessibilityLabel={name ? `Avatar de ${name}` : 'Avatar'}
    >
      <Text className="text-primary font-bold" style={{ fontSize: size * 0.42 }}>
        {initial}
      </Text>
    </View>
  );
}
