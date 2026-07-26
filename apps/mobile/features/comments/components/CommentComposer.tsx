import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { commentBodySchema } from '../schemas';

const MAX_LENGTH = 500;

type Props = {
  onSubmit: (body: string) => void;
  isSubmitting?: boolean;
  /** Fired when the input gains focus (used to scroll the composer into view). */
  onFocus?: () => void;
};

/**
 * Text input + submit button to publish a comment. Enforces the 1–500 range
 * client-side (the Edge Function re-validates). Clears itself on submit.
 */
export function CommentComposer({ onSubmit, isSubmitting = false, onFocus }: Props) {
  const [value, setValue] = useState('');
  const parsed = commentBodySchema.safeParse(value);
  const canSubmit = parsed.success && !isSubmitting;

  const handleSubmit = () => {
    if (!parsed.success) return;
    onSubmit(parsed.data);
    setValue('');
  };

  return (
    <View className="bg-surface rounded-card p-4 mb-4">
      <TextInput
        className="text-content text-sm min-h-[44px]"
        placeholder="Escribe un comentario…"
        placeholderTextColor="#94a3b8"
        value={value}
        onChangeText={setValue}
        onFocus={onFocus}
        maxLength={MAX_LENGTH}
        multiline
        editable={!isSubmitting}
        accessibilityLabel="Escribe un comentario"
      />
      {isSubmitting && (
        <View className="flex-row items-center gap-2 mt-3" accessibilityRole="alert">
          <ActivityIndicator size="small" color="#FFD60A" />
          <Text className="text-content-muted text-xs flex-1">
            ⏳ Tu comentario está siendo revisado por nuestro agente de IA…
          </Text>
        </View>
      )}
      <View className="flex-row items-center justify-between mt-3">
        <Text className="text-content-muted text-xs">
          {value.length}/{MAX_LENGTH}
        </Text>
        <TouchableOpacity
          className={`rounded-pill px-5 py-2 ${canSubmit ? 'bg-primary' : 'bg-surface-2'}`}
          onPress={handleSubmit}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityLabel="Publicar comentario"
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#0f172a" />
          ) : (
            <Text className={canSubmit ? 'text-background font-bold' : 'text-content-subtle font-bold'}>
              Comentar
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
