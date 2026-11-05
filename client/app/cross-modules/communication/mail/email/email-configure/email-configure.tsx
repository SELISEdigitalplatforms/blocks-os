import React, { useState } from "react";
import { Mail } from "lucide-react";
import DeleteEmailConfig from "@blocks-communication/mail/components/email-service/modals/delete-email-config/delete-email-config";
import NewConfiguration from "@blocks-communication/mail/components/email-service/modals/new-configuration/new-configuration";
import { AssignTemplatesDialog } from "@blocks-communication/mail/components/email-service/modals/assign-templates/assign-templates";
import EditDefaultSenderName from "@blocks-communication/mail/components/email-service/modals/edit-default-sender-name/edit-default-sender-name";
import { EmailConfigCard } from "@blocks-communication/mail/components/email-service/email-config-card/email-config-card";
import { Accordion } from "@/components/ui-kits/accordion/accordion";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { IEmailConfig } from "@blocks-communication/mail/models/email";
import { useGetEmailSecretConfigs } from "@blocks-communication/mail/hooks/use-email-config";
import { useEmailOrganization } from "@blocks-communication/mail/hooks/use-email-organization";
import {
  DEFAULT_ORGANIZATION_ID,
  organizationOf,
} from "@blocks-communication/mail/constants/organization";
import { useGetOrganizationById } from "@blocks-idp/iam/hooks/use-organization";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { EmptyState } from "@/components/ui-kits/empty-state";
import { parseAsBoolean, useQueryState } from "nuqs";
import { useProjectStore, useT } from "@seliseblocks/genesis-os";

interface EmailConfigurationProps {
  addConfigOpen?: boolean;
  onAddConfigOpenChange?: (open: boolean) => void;
  /**
   * The Email page lists one organization at a time, picked in its header. Other hosts (the
   * authentication settings dialog) list every configuration, as before organizations.
   */
  organizationScoped?: boolean;
}

interface ConfigListProps {
  configs: IEmailConfig[];
  showOrganization: boolean;
  organizationNameOf: (config: IEmailConfig) => string;
  /** The list whose first card opens expanded; a later section starts collapsed. */
  expandFirst: boolean;
  /**
   * Every configuration the page loaded (the organization's and the Default organization's), for
   * the Assign templates dialog's "Current configuration" names. Without it, no card offers the
   * dialog (hosts other than the Email page).
   */
  assignConfigs?: IEmailConfig[];
}

/**
 * Cards with their own edit and delete dialogs. The id of the one row whose dialog is open is kept,
 * because every row renders its own dialog: a shared boolean opened all of them at once, and the
 * last row's dialog, on top, was the one acted on.
 */
function ConfigList({
  configs,
  showOrganization,
  organizationNameOf,
  expandFirst,
  assignConfigs,
}: Readonly<ConfigListProps>) {
  const { t } = useT("os.communication.mail");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  return (
    <Accordion
      type="single"
      collapsible
      className="mt-6"
      defaultValue={expandFirst ? configs[0]?.itemId : undefined}
    >
      {configs.map((config, index) => (
        <EmailConfigCard
          key={config.itemId}
          config={config}
          isFirst={index === 0}
          showOrganization={showOrganization}
          organizationName={organizationNameOf(config)}
          onEdit={() => setEditingId(config.itemId)}
          onDelete={() => setDeletingId(config.itemId)}
          onAssign={assignConfigs ? () => setAssigningId(config.itemId) : undefined}
        >
          <Dialog
            open={editingId === config.itemId}
            onOpenChange={(isOpen) => setEditingId(isOpen ? config.itemId : null)}
          >
            {/* The form lives only while its dialog is open, so Cancel drops unsaved input
                and the next open starts from the stored record. */}
            {editingId === config.itemId && config.isDefault && (
              <EditDefaultSenderName config={config} onClose={() => setEditingId(null)} />
            )}
            {editingId === config.itemId && !config.isDefault && (
              <NewConfiguration
                dialogTitle={t("EMAIL_CONFIGURE.EDIT_CONFIGURATION")}
                previousData={config}
                isEdit={true}
                organization={
                  showOrganization
                    ? { id: organizationOf(config), name: organizationNameOf(config) }
                    : undefined
                }
                onClose={() => setEditingId(null)}
              />
            )}
          </Dialog>
          <Dialog
            open={deletingId === config.itemId}
            onOpenChange={(isOpen) => setDeletingId(isOpen ? config.itemId : null)}
          >
            {deletingId === config.itemId && (
              <DeleteEmailConfig configId={config.itemId} onClose={() => setDeletingId(null)} />
            )}
          </Dialog>
          {assignConfigs && (
            <Dialog
              open={assigningId === config.itemId}
              onOpenChange={(isOpen) => setAssigningId(isOpen ? config.itemId : null)}
            >
              {/* Mounted only while open, so each opening starts with no selection (C9). */}
              {assigningId === config.itemId && (
                <AssignTemplatesDialog
                  config={config}
                  configs={assignConfigs}
                  organizationName={organizationNameOf(config)}
                  showOrganization={showOrganization}
                  onClose={() => setAssigningId(null)}
                />
              )}
            </Dialog>
          )}
        </EmailConfigCard>
      ))}
    </Accordion>
  );
}

/** The page's organization, its name, and whether the page is split by organization at all. */
function useListedOrganization(organizationScoped: boolean) {
  const { t } = useT("os.communication.mail");
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  const organization = useEmailOrganization();
  const byOrganization = organizationScoped && organization.isMultiOrgEnabled;
  const selectedOrganizationId = organization.selectedOrganizationId;
  // A non-Default organization of a multi-org page; the Default organization is not an IAM record.
  const isOtherOrganization = byOrganization && selectedOrganizationId !== DEFAULT_ORGANIZATION_ID;
  const { data: selectedOrganization } = useGetOrganizationById({
    projectKey: tenantId,
    itemId: isOtherOrganization ? selectedOrganizationId : "",
  });
  const defaultOrganizationName = t("EMAIL_CONFIGURE.DEFAULT_ORGANIZATION");
  const selectedOrganizationName = isOtherOrganization
    ? (selectedOrganization?.organization?.name ?? selectedOrganizationId)
    : defaultOrganizationName;

  return {
    byOrganization,
    isOtherOrganization,
    selectedOrganizationId,
    selectedOrganizationName,
    // The Email page waits for the organization config; other hosts list everything at once.
    isLoading: organizationScoped && organization.isLoading,
    organizationNameOf: (config: IEmailConfig) =>
      organizationOf(config) === DEFAULT_ORGANIZATION_ID
        ? defaultOrganizationName
        : selectedOrganizationName,
  };
}

/** The selected organization's configurations, and the Default organization's shared ones below them. */
const splitByOrganization = (
  data: IEmailConfig[],
  listed: { byOrganization: boolean; isOtherOrganization: boolean; selectedOrganizationId: string },
) => ({
  organizationConfigs: listed.byOrganization
    ? data.filter((config) => organizationOf(config) === listed.selectedOrganizationId)
    : data,
  sharedConfigs: listed.isOtherOrganization
    ? data.filter((config) => organizationOf(config) === DEFAULT_ORGANIZATION_ID)
    : [],
});

/** No configurations: the project's empty state, or the selected organization's. */
function ConfigurationsEmptyState({ organizationName }: Readonly<{ organizationName?: string }>) {
  const { t } = useT("os.communication.mail");
  return organizationName ? (
    <EmptyState
      icon={Mail}
      title={t("EMAIL_CONFIGURE.ORGANIZATION_EMPTY_TITLE", { organization: organizationName })}
      description={t("EMAIL_CONFIGURE.ORGANIZATION_EMPTY_DESCRIPTION", {
        organization: organizationName,
      })}
    />
  ) : (
    <EmptyState
      icon={Mail}
      title={t("EMAIL_CONFIGURE.EMPTY_TITLE")}
      description={t("EMAIL_CONFIGURE.EMPTY_DESCRIPTION")}
    />
  );
}

export function EmailConfiguration({
  addConfigOpen,
  onAddConfigOpenChange,
  organizationScoped = false,
}: EmailConfigurationProps = {}) {
  const { t } = useT("os.communication.mail");
  const [internalOpen, setInternalOpen] = useState<boolean>(false);
  const open = addConfigOpen ?? internalOpen;
  const setOpen = onAddConfigOpenChange || setInternalOpen;

  const listed = useListedOrganization(organizationScoped);
  // Without organizations the page lists everything, as before; it waits for the organization
  // config on the Email page so it doesn't list everything first and then one organization.
  const { isLoading, data: secretData } = useGetEmailSecretConfigs(
    listed.byOrganization ? listed.selectedOrganizationId : undefined,
    !listed.isLoading,
  );
  // Assign templates is an Email-page action (SPEC32 H6); other hosts list cards only.
  const assignConfigs = organizationScoped ? (secretData?.configurations ?? []) : undefined;
  const { organizationConfigs, sharedConfigs } = splitByOrganization(
    secretData?.configurations || [],
    listed,
  );

  if (isLoading || listed.isLoading) {
    return (
      <div className="grid gap-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full rounded" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <Dialog open={open} onOpenChange={setOpen}>
        {open && (
          <NewConfiguration
            dialogTitle={t("EMAIL_CONFIGURE.ADD_CONFIGURATION")}
            onClose={() => setOpen(false)}
            isEdit={false}
            organization={
              listed.byOrganization
                ? { id: listed.selectedOrganizationId, name: listed.selectedOrganizationName }
                : undefined
            }
            organizationHasDefault={organizationConfigs.some(
              (config) => config.isOrganizationDefault,
            )}
          />
        )}
      </Dialog>
      {listed.byOrganization && (
        <div className="mt-6 flex flex-col gap-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("EMAIL_CONFIGURE.ORGANIZATION_SECTION", {
              organization: listed.selectedOrganizationName,
              count: organizationConfigs.length,
            })}
          </h2>
          {!listed.isOtherOrganization && (
            <p className="text-sm text-muted-foreground">
              {t("EMAIL_CONFIGURE.DEFAULT_ORGANIZATION_SECTION_HINT")}
            </p>
          )}
        </div>
      )}
      {organizationConfigs.length > 0 ? (
        <ConfigList
          configs={organizationConfigs}
          showOrganization={listed.byOrganization}
          organizationNameOf={listed.organizationNameOf}
          expandFirst
          assignConfigs={assignConfigs}
        />
      ) : (
        <ConfigurationsEmptyState
          organizationName={
            listed.isOtherOrganization ? listed.selectedOrganizationName : undefined
          }
        />
      )}
      {sharedConfigs.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("EMAIL_CONFIGURE.FROM_DEFAULT_ORGANIZATION")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("EMAIL_CONFIGURE.DEFAULT_ORGANIZATION_SECTION_HINT")}
          </p>
          <ConfigList
            configs={sharedConfigs}
            showOrganization={listed.byOrganization}
            organizationNameOf={listed.organizationNameOf}
            expandFirst={organizationConfigs.length === 0}
            assignConfigs={assignConfigs}
          />
        </section>
      )}
    </div>
  );
}

export function EmailConfigurationPage() {
  const [addOpen, setAddOpen] = useQueryState("emailConfig", parseAsBoolean.withDefault(false));
  return (
    <EmailConfiguration
      addConfigOpen={addOpen}
      onAddConfigOpenChange={setAddOpen}
      organizationScoped
    />
  );
}
