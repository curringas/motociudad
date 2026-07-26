// Presentational moderation queue (pure): renders pending comments with
// approve/reject actions. No hooks — the screen wires data/mutations in.
// Feature ai-comment-moderation · panel admin (cola mínima).
import React from 'react';
import { View, Text } from 'react-native';
import type { AdminComment } from '../schemas';
import { C, Card, Button, Banner, Spinner } from '../ui';

export function pendingAuthorName(c: AdminComment): string {
  return (
    c.author?.display_name?.trim() ||
    c.author?.username?.trim() ||
    'Motero anónimo'
  );
}

type Props = {
  comments: AdminComment[];
  isLoading?: boolean;
  isError?: boolean;
  errorText?: string;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  busyId?: string | null;
};

export function PendingCommentsQueue({
  comments,
  isLoading = false,
  isError = false,
  errorText,
  onApprove,
  onReject,
  busyId,
}: Props) {
  if (isLoading) return <Spinner label="Cargando cola de moderación…" />;
  if (isError) return <Banner kind="error">Error al cargar: {errorText}</Banner>;
  if (comments.length === 0) {
    return <Banner kind="info">No hay comentarios pendientes de revisión. 🎉</Banner>;
  }

  return (
    <View style={{ gap: 12 }}>
      {comments.map((c) => (
        <Card key={c.id}>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
              <Text style={{ color: C.text, fontSize: 15, fontWeight: '700', flex: 1 }}>
                {pendingAuthorName(c)}
              </Text>
              <Text style={{ color: C.muted, fontSize: 12 }} numberOfLines={1}>
                {c.parking?.name ?? 'Parking'}
              </Text>
            </View>

            <Text style={{ color: C.text, fontSize: 14, lineHeight: 20 }}>{c.body}</Text>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <Button
                label="Aprobar"
                variant="primary"
                onPress={() => onApprove(c.id)}
                loading={busyId === c.id}
              />
              <Button
                label="Rechazar"
                variant="danger"
                onPress={() => onReject(c.id)}
                loading={busyId === c.id}
              />
            </View>
          </View>
        </Card>
      ))}
    </View>
  );
}
