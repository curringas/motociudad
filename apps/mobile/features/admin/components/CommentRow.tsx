// Fila compacta (2 líneas) de un comentario en el panel admin. Presentacional.
// OpenSpec: changes/admin-comments-management.
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { formatRelativeTime } from '@/features/comments/presenter';
import type { AdminComment } from '../schemas';
import { C, Checkbox, CommentStatusBadge } from '../ui';

export function authorName(c: AdminComment): string {
  return c.display_name?.trim() || c.username?.trim() || 'Motero anónimo';
}

type Props = {
  comment: AdminComment;
  checked: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onDelete: () => void;
  busy?: boolean;
};

export function CommentRow({ comment: c, checked, onToggle, onApprove, onDelete, busy = false }: Props) {
  const isPending = c.moderation_status === 'pending_review';
  return (
    <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border }}>
      <View style={{ paddingTop: 2 }}>
        <Checkbox checked={checked} onToggle={onToggle} label={`Seleccionar comentario de ${authorName(c)}`} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Text style={{ color: C.text, fontWeight: '700', fontSize: 13 }}>{authorName(c)}</Text>
          <CommentStatusBadge status={c.moderation_status} />
          <Text style={{ color: C.muted, fontSize: 11 }} numberOfLines={1}>
            · {c.parking_name ?? 'Parking'} · {c.city ?? '—'} · {formatRelativeTime(c.created_at)}
            {c.upvotes_count > 0 ? ` · ▲${c.upvotes_count}` : ''}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Text style={{ color: C.text, fontSize: 14, lineHeight: 20, flex: 1 }}>{c.body}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {isPending ? (
              <Pressable onPress={onApprove} disabled={busy} accessibilityRole="button" accessibilityLabel="Aprobar comentario">
                <Text style={{ color: C.success, fontSize: 12, fontWeight: '700' }}>✓ Aprobar</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={onDelete} disabled={busy} accessibilityRole="button" accessibilityLabel="Eliminar comentario">
              <Text style={{ color: C.danger, fontSize: 12, fontWeight: '700' }}>Eliminar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}
