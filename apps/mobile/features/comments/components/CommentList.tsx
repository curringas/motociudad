import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import type { CommentView } from '../presenter';
import { CommentItem } from './CommentItem';

type Props = {
  comments: CommentView[];
  isLoading?: boolean;
  onUpvote: (id: string) => void;
  onDelete: (id: string) => void;
  votingId?: string | null;
  deletingId?: string | null;
};

/** Renders the comment list with loading and empty states. */
export function CommentList({
  comments,
  isLoading = false,
  onUpvote,
  onDelete,
  votingId,
  deletingId,
}: Props) {
  if (isLoading) {
    return (
      <View className="py-6 items-center">
        <ActivityIndicator size="small" color="#FFD60A" />
      </View>
    );
  }

  if (comments.length === 0) {
    return (
      <View className="bg-surface rounded-card p-4 items-center">
        <Text className="text-content-subtle text-sm text-center">
          Sé el primero en comentar y gana 10 Octanos.
        </Text>
      </View>
    );
  }

  return (
    <View>
      {comments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          onUpvote={onUpvote}
          onDelete={onDelete}
          isVoting={votingId === comment.id}
          isDeleting={deletingId === comment.id}
        />
      ))}
    </View>
  );
}
