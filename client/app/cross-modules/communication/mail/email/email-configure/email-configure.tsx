import React, { useState } from "react";
import { Mail } from "lucide-react";
import DeleteEmailConfig from "@blocks-communication/mail/components/email-service/modals/delete-email-config/delete-email-config";
import NewConfiguration from "@blocks-communication/mail/components/email-service/modals/new-configuration/new-configuration";
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
}: Readonly<ConfigListProps>) {
  const { t } = useT("os.communication.mail");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
        </EmailConfigCard>
      ))}
    </Accordion>
  );
}

export function EmailConfiguration({
  addConfigOpen,
  onAddConfigOpenChange,
  organizationScoped = false,
}: EmailConfigurationProps = {}) {
  const { t } = useT("os.communication.mail");
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  const [internalOpen, setInternalOpen] = useState<boolean>(false);
  const open = addConfigOpen ?? internalOpen;
  const setOpen = onAddConfigOpenChange || setInternalOpen;

  const organization = useEmailOrganization();
  const byOrganization = organizationScoped && organization.isMultiOrgEnabled;
  const selectedOrganizationId = organization.selectedOrganizationId;
  const { data: selectedOrganization } = useGetOrganizationById({
    projectKey: tenantId,
    itemId:
      byOrganization && selectedOrganizationId !== DEFAULT_ORGANIZATION_ID
        ? selectedOrganizationId
        : "",
  });

  // Without organizations the page lists everything, as before; it waits for the organization
  // config on the Email page so it doesn't list everything first and then one organization.
  const { isLoading, data: secretData } = useGetEmailSecretConfigs(
    byOrganization ? selectedOrganizationId : undefined,
    !organizationScoped || !organization.isLoading,
  );
  const data = secretData?.configurations || [];

  const defaultOrganizationName = t("EMAIL_CONFIGURE.DEFAULT_ORGANIZATION");
  const selectedOrganizationName =
    selectedOrganizationId === DEFAULT_ORGANIZATION_ID
      ? defaultOrganizationName
      : (selectedOrganization?.organization?.name ?? selectedOrganizationId);
  const organizationNameOf = (config: IEmailConfig) =>
    organizationOf(config) === DEFAULT_ORGANIZATION_ID
      ? defaultOrganizationName
      : selectedOrganizationName;

  const organizationConfigs = byOrganization
    ? data.filter((config) => organizationOf(config) === selectedOrganizationId)
    : data;
  const sharedConfigs =
    byOrganization && selectedOrganizationId !== DEFAULT_ORGANIZATION_ID
      ? data.filter((config) => organizationOf(config) === DEFAULT_ORGANIZATION_ID)
      : [];
  const organizationHasDefault = organizationConfigs.some((config) => config.isOrganizationDefault);

  if (isLoading || (organizationScoped && organization.isLoading)) {
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
              byOrganization
                ? { id: selectedOrganizationId, name: selectedOrganizationName }
                : undefined
            }
            organizationHasDefault={organizationHasDefault}
          />
        )}
      </Dialog>
      {byOrganization && (
        <div className="mt-6 flex flex-col gap-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("EMAIL_CONFIGURE.ORGANIZATION_SECTION", {
              organization: selectedOrganizationName,
              count: organizationConfigs.length,
            })}
          </h2>
          {selectedOrganizationId === DEFAULT_ORGANIZATION_ID && (
            <p className="text-sm text-muted-foreground">
              {t("EMAIL_CONFIGURE.DEFAULT_ORGANIZATION_SECTION_HINT")}
            </p>
          )}
        </div>
      )}
      {organizationConfigs.length > 0 ? (
        <ConfigList
          configs={organizationConfigs}
          showOrganization={byOrganization}
          organizationNameOf={organizationNameOf}
          expandFirst
        />
      ) : (
        <EmptyState
          icon={Mail}
          title={
            byOrganization && selectedOrganizationId !== DEFAULT_ORGANIZATION_ID
              ? t("EMAIL_CONFIGURE.ORGANIZATION_EMPTY_TITLE", {
                  organization: selectedOrganizationName,
                })
              : t("EMAIL_CONFIGURE.EMPTY_TITLE")
          }
          description={
            byOrganization && selectedOrganizationId !== DEFAULT_ORGANIZATION_ID
              ? t("EMAIL_CONFIGURE.ORGANIZATION_EMPTY_DESCRIPTION", {
                  organization: selectedOrganizationName,
                })
              : t("EMAIL_CONFIGURE.EMPTY_DESCRIPTION")
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
            showOrganization={byOrganization}
            organizationNameOf={organizationNameOf}
            expandFirst={organizationConfigs.length === 0}
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
