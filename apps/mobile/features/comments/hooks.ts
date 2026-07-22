import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parkingKeys } from '@/features/parkings/hooks';
import {
  deleteComment,
  fetchParkingComments,
  postComment,
  voteComment,
} from './api';

/** Query key factory for the comments domain. */
export const commentKeys = {
  all: ['comments'] as const,
  list: (parkingId: string) => [...commentKeys.all, 'list', parkingId] as const,
};

/** Non-deleted comments of a parking, newest first. */
export function useParkingComments(parkingId: string | undefined) {
  return useQuery({
    queryKey: commentKeys.list(parkingId ?? ''),
    queryFn: () => fetchParkingComments(parkingId as string),
    enabled: !!parkingId,
    staleTime: 30_000,
  });
}

function invalidateParking(
  queryClient: ReturnType<typeof useQueryClient>,
  parkingId: string,
) {
  void queryClient.invalidateQueries({ queryKey: commentKeys.list(parkingId) });
  // Refresh the detail so comments_count updates.
  void queryClient.invalidateQueries({ queryKey: parkingKeys.detail(parkingId) });
}

/** Publish a comment; refreshes the list and the parking detail on success. */
export function usePostComment(parkingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => postComment(parkingId, body),
    onSuccess: () => invalidateParking(queryClient, parkingId),
  });
}

/** Upvote/downvote a comment; refreshes the list on success. */
export function useVoteComment(parkingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, value }: { commentId: string; value: 1 | -1 }) =>
      voteComment(commentId, value),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: commentKeys.list(parkingId),
      });
    },
  });
}

/** Soft-delete the caller's own comment; refreshes the list and detail. */
export function useDeleteComment(parkingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => deleteComment(commentId),
    onSuccess: () => invalidateParking(queryClient, parkingId),
  });
}
