import { useProjectStore } from "@seliseblocks/blocks-kit";
import { peopleService } from "@blocks-identifier/services/people.service";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const useGetPeople = (option: { page: number; pageSize: number; filter: string }) => {
  const projectGroupId = useProjectStore().selectedTenantGroup || "";
  return useQuery({
    queryKey: ["people", option, projectGroupId],
    queryFn: () =>
      peopleService.getPeople({
        ...option,
        projectGroupId,
      }),
    select: (response) => ({
      peoples: response.peoples,
      totalCount: response.peoplesTotalCount,
      isOwner: response.isOwner,
    }),
    enabled: !!projectGroupId,
    refetchOnMount: "always",
  });
};

export const useInvitePeople = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["people", "add"],
    mutationFn: peopleService.invitePeople,
    onSuccess: async () => {
      // New users are created by a background worker after the invite returns, so refreshing
      // the list immediately would briefly show them missing. Wait a moment first so the
      // invite feels like it completed on the fly. mutateAsync awaits this callback, so the
      // dialog also stays in its pending state until the list is ready to show the person.
      await new Promise((resolve) => setTimeout(resolve, 3000));
      queryClient.invalidateQueries({ queryKey: ["people"] });
      queryClient.invalidateQueries({ queryKey: ["subscription-usage"] });
    },
  });
};

export const useResendInvitation = () => {
  return useMutation({
    mutationKey: ["people", "resend-invite"],
    mutationFn: peopleService.resendInvitation,
  });
};

export const useRemoveAccess = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["people", "revoke-access"],
    mutationFn: peopleService.removeAccess,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["people"] });
      queryClient.invalidateQueries({ queryKey: ["subscription-usage"] });
    },
  });
};

export const useRemoveEnvironmentAccess = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["people", "remove-environment-access"],
    mutationFn: peopleService.removeEnvironmentAccess,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["people"] });
      queryClient.invalidateQueries({ queryKey: ["subscription-usage"] });
    },
  });
};

export const useConfirmInvitation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["people", "confirm-invite"],
    mutationFn: peopleService.confirmInvitation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["identifier", "projects"] });
    },
  });
};

/** Public email-link flow: accept project invitation (unauthenticated). */
export const usePeopleAcceptInvitation = () => {
  return useMutation({
    mutationKey: ["people", "accept-invite"],
    mutationFn: peopleService.peopleAcceptInvitation,
  });
};

export const useTransferOwnership = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["people", "transfer-ownership"],
    mutationFn: peopleService.transferOwnership,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["people"] });
      queryClient.invalidateQueries({ queryKey: ["identifier", "projects"] });
    },
  });
};
