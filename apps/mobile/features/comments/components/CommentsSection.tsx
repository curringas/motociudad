import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSessionStore } from '@/stores/sessionStore';
import {
  useParkingComments,
  usePostComment,
  useVoteComment,
  useDeleteComment,
} from '../hooks';
import { toCommentView } from '../presenter';
import { CommentComposer } from './CommentComposer';
import { CommentList } from './CommentList';

type Props = { parkingId: string };

type Feedback = { kind: 'success' | 'info' | 'error'; text: string };

/** How long a success/info banner stays before auto-dismissing (ms). */
const FEEDBACK_TTL_MS = 6000;

/**
 * Full comments block for a parking: header, composer (or login hint), feedback
 * banner, and list. Self-contained (wires hooks + session), so it can be dropped
 * into both the native and web parking-detail screens.
 */
export function CommentsSection({ parkingId }: Props) {
  const router = useRouter();
  const { user } = useSessionStore();

  const { data: rows = [], isLoading } = useParkingComments(parkingId);
  const postMutation = usePostComment(parkingId);
  const voteMutation = useVoteComment(parkingId);
  const deleteMutation = useDeleteComment(parkingId);

  const [feedback, setFeedback] = useState<Feedback | null>(null);

  // Auto-dismiss non-error banners so they don't linger, but stay long enough
  // to be read (the list refresh underneath is what made the old text fleeting).
  useEffect(() => {
    if (!feedback || feedback.kind === 'error') return;
    const t = setTimeout(() => setFeedback(null), FEEDBACK_TTL_MS);
    return () => clearTimeout(t);
  }, [feedback]);

  const comments = useMemo(
    () => rows.map((row) => toCommentView(row, user?.id)),
    [rows, user?.id],
  );

  const handleSubmit = async (body: string) => {
    setFeedback(null);
    try {
      const res = await postMutation.mutateAsync(body);
      if (!res.success) {
        setFeedback({ kind: 'error', text: res.error?.message ?? 'No se pudo publicar el comentario' });
      } else if (res.data && res.data.octanos_earned > 0) {
        setFeedback({ kind: 'success', text: `🎉 ¡+${res.data.octanos_earned} Octanos por tu comentario!` });
      } else if (res.data?.cap_reached) {
        setFeedback({ kind: 'info', text: 'Comentario publicado. Hoy ya has alcanzado el límite diario de Octanos.' });
      } else {
        setFeedback({ kind: 'info', text: 'Comentario publicado. ¡Gracias por aportar!' });
      }
    } catch {
      setFeedback({ kind: 'error', text: 'Error de red al publicar. Inténtalo de nuevo.' });
    }
  };

  const handleUpvote = async (commentId: string) => {
    setFeedback(null);
    try {
      const res = await voteMutation.mutateAsync({ commentId, value: 1 });
      if (!res.success) setFeedback({ kind: 'error', text: res.error?.message ?? 'No se pudo votar' });
    } catch {
      setFeedback({ kind: 'error', text: 'Error de red al votar.' });
    }
  };

  const handleDelete = async (commentId: string) => {
    setFeedback(null);
    try {
      await deleteMutation.mutateAsync(commentId);
    } catch {
      setFeedback({ kind: 'error', text: 'Error de red al borrar.' });
    }
  };

  return (
    <View className="mb-4">
      <Text className="text-content-muted text-sm mb-2 font-semibold uppercase tracking-wider">
        Comentarios
      </Text>

      {user ? (
        <CommentComposer
          onSubmit={handleSubmit}
          isSubmitting={postMutation.isPending}
        />
      ) : (
        <TouchableOpacity
          className="bg-surface border border-primary rounded-card p-4 items-center mb-4"
          onPress={() =>
            router.push({ pathname: '/login', params: { redirect: `/parking/${parkingId}` } })
          }
          accessibilityRole="button"
          accessibilityLabel="Inicia sesión para comentar"
        >
          <Text className="text-primary font-bold">Inicia sesión para comentar</Text>
        </TouchableOpacity>
      )}

      {feedback && !postMutation.isPending ? (
        <FeedbackBanner feedback={feedback} />
      ) : null}

      <CommentList
        comments={comments}
        isLoading={isLoading}
        onUpvote={handleUpvote}
        onDelete={handleDelete}
        votingId={voteMutation.isPending ? (voteMutation.variables?.commentId ?? null) : null}
        deletingId={deleteMutation.isPending ? (deleteMutation.variables ?? null) : null}
      />
    </View>
  );
}

/** Colored, readable banner for post/vote/delete outcomes. */
function FeedbackBanner({ feedback }: { feedback: Feedback }) {
  const styles = {
    success: { box: 'bg-verified/15 border border-verified', text: 'text-verified' },
    info: { box: 'bg-surface border border-border', text: 'text-content-muted' },
    error: { box: 'bg-danger/15 border border-danger', text: 'text-danger' },
  }[feedback.kind];

  return (
    <View className={`rounded-card p-3 mb-3 ${styles.box}`} accessibilityRole="alert">
      <Text className={`text-sm font-semibold ${styles.text}`}>{feedback.text}</Text>
    </View>
  );
}
