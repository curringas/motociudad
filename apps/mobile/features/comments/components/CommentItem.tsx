import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import type { CommentView } from '../presenter';

type Props = {
  comment: CommentView;
  onUpvote: (id: string) => void;
  onDelete: (id: string) => void;
  isVoting?: boolean;
  isDeleting?: boolean;
};

/** A single comment row: author, body, relative time, upvote and delete. */
export function CommentItem({ comment, onUpvote, onDelete, isVoting = false, isDeleting = false }: Props) {
  return (
    <View className="bg-surface rounded-card p-4 mb-3">
      <View className="flex-row items-center justify-between mb-1">
        <View className="flex-row items-center gap-2 flex-1 mr-2">
          <Text className="text-content font-semibold text-sm" numberOfLines={1}>
            {comment.authorName}
          </Text>
          {comment.authorLevel != null && (
            <View className="bg-primary/15 rounded-pill px-2 py-0.5">
              <Text className="text-primary text-[10px] font-bold">
                Nv {comment.authorLevel}
              </Text>
            </View>
          )}
        </View>
        <Text className="text-content-muted text-xs">{comment.timeLabel}</Text>
      </View>

      <Text className="text-content text-sm mb-3">{comment.body}</Text>

      <View className="flex-row items-center gap-4">
        <TouchableOpacity
          className="flex-row items-center gap-1.5"
          onPress={() => onUpvote(comment.id)}
          disabled={isVoting}
          accessibilityRole="button"
          accessibilityLabel="Votar útil este comentario"
        >
          <Text className="text-primary text-sm">▲</Text>
          <Text className="text-content-muted text-sm">{comment.upvotes}</Text>
        </TouchableOpacity>

        {comment.canDelete && (
          <TouchableOpacity
            onPress={() => onDelete(comment.id)}
            disabled={isDeleting}
            accessibilityRole="button"
            accessibilityLabel="Borrar mi comentario"
          >
            <Text className="text-rejected text-sm font-semibold">Borrar</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
