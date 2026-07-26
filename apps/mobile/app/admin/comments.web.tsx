// Sección Comentarios del panel (cola mínima de moderación, solo admin).
// Lista los comentarios pending_review y permite aprobar/rechazar (vía Edge
// Function admin-moderate-comment). La gestión rica (borrar/restaurar/filtros)
// se difiere a la feature admin-comments-management.
import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { Redirect } from 'expo-router';
import {
  useCurrentProfile,
  useAdminPendingComments,
  useModerateComment,
} from '@/features/admin/hooks';
import { canManageUsers } from '@/features/admin/permissions';
import { C, Banner } from '@/features/admin/ui';
import { PendingCommentsQueue } from '@/features/admin/components/PendingCommentsQueue';

export default function AdminCommentsWeb() {
  const { data: profile, isLoading: profileLoading } = useCurrentProfile();
  const isAdmin = canManageUsers(profile);
  const { data: comments, isLoading, isError, error } = useAdminPendingComments(isAdmin);
  const moderate = useModerateComment();
  const [err, setErr] = useState<string | null>(null);

  // El layout ya bloquea a no-admin; reforzamos igual que en Usuarios.
  if (!profileLoading && !isAdmin) {
    return <Redirect href="/admin/parkings" />;
  }

  const run = (commentId: string, action: 'approve' | 'reject') => {
    setErr(null);
    moderate.mutate({ commentId, action }, { onError: (e) => setErr((e as Error).message) });
  };

  return (
    <View style={{ gap: 16, maxWidth: 820, width: '100%', alignSelf: 'center' }}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: C.text, fontSize: 22, fontWeight: '800' }}>Comentarios</Text>
        <Text style={{ color: C.muted, fontSize: 13 }}>
          Cola de moderación: comentarios pendientes de revisión por el agente de IA.
        </Text>
      </View>

      {err ? <Banner kind="error">{err}</Banner> : null}

      <PendingCommentsQueue
        comments={comments ?? []}
        isLoading={isLoading}
        isError={isError}
        errorText={(error as Error)?.message}
        onApprove={(id) => run(id, 'approve')}
        onReject={(id) => run(id, 'reject')}
        busyId={moderate.isPending ? moderate.variables?.commentId ?? null : null}
      />
    </View>
  );
}
