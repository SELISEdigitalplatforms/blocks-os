using Blocks.Genesis;

namespace DomainService.Shared
{
    public static class IdentifierConstants
    {
        public const int KeyLength = 2048;
        public const string AlgorithmName = "SHA256WITHRSA";
        public const string KeyVaultUrl = "KeyVaultUrl";
        public const string TenantId = "TenantId";
        public const string ClientId = "ClientId";
        public const string ClientSecret = "ClientSecret";
        public const string Issuer = "SeliseBlocks";
        public const string Subject = "Selise-Blocks";
        public const string KeyVault = "KeyVault";
        public const string TenantCollectionName = "Tenants";
        public const string TenantAssetCollectionName = "TenantAssets";
        public const string ProjectPeopleCollectionName = "ProjectPeoples";
        public const string MigrationTrackerCollectionName = "MigrationTrackers";
        public const string ThirdPartyJWTClaimsCollectionName = "ThirdPartyJWTClaims";

        /// <summary>
        /// The one database every cross-project collection lives in. ProjectPeoples in
        /// particular is only ever written here, so anything deciding project membership or
        /// ownership has to read it from here too rather than from the caller's tenant database.
        /// </summary>
        public const string RootDatabaseName = "BlocksRootDb";

        public const string IdentifierQueueName = "blocks_project_listener";
        public const string DataCleanupQueue = "blocks_data_cleanup_listener";
        public const string LanguageDataMigrationQueue = "blocks_localization_environment_data_migration_listener";
        public const string IamQueue = "blocks_iam_listener_user";
        public const string MailQueue = "blocks_email_listener";
        public const string GenericMigrationQueue = "blocks_generic_migration_listener";
        // Published to, never consumed here — blocks-release's worker owns this queue and is what
        // declares it. Deliberately absent from the MessageConfiguration below: binding a queue this
        // service has no consumer for would let the broker hand it deletes it would silently drop.
        public const string ReleaseProjectDeleteQueue = "blocks_release_project_delete_listener";
        public const string MigrationCompletionTopic = "blocks_migration_topic";
        public const string ProjectPeopleInvitationMailPurpose = "project_invitation";
        public const string BlocksDomain = "seliseblocks.com";
        public const string ConstructCookieDomain = "slsblx.com";

        public const string CertbotWebrootPath = "/var/www/html";
        public const string CertbotEmail = "devsecops@selisegroup.com";
        public const string RemoteFeTemplate = "/home/nginxreverseproxy/fe-domain.conf";
        public const string RemoteBlocksapiTemplate = "/home/nginxreverseproxy/blocksapi-domain.conf";

        // The LMT queue names deliberately live only in Cloud.LmtService.Utilities.Constants.
        // They were duplicated here too, which meant renaming one queue required editing two files
        // in lockstep; miss one and Api publishes to a queue no host is listening on. Nothing in
        // this project consumes or publishes to them — the senders all reference the LMT constants.
        private const string DefaultProvider = "azure";
        private const string RabbitMqProvider = "rabbitmq";


        public static MessageConfiguration GetMessageConfiguration(string messageConnectionString)
        {
            var provider = GetProvider(messageConnectionString);

            return provider switch
            {
                RabbitMqProvider => CreateRabbitMqConfiguration(),
                _ => CreateAzureServiceBusConfiguration()
            };
        }

        private static string GetProvider(string messageConnectionString)
        {
            if (Uri.TryCreate(messageConnectionString, UriKind.Absolute, out var uri))
            {
                if (uri.Scheme.Equals("amqp", StringComparison.OrdinalIgnoreCase) ||
                    uri.Scheme.Equals("amqps", StringComparison.OrdinalIgnoreCase))
                {
                    return RabbitMqProvider;
                }
            }

            return DefaultProvider;
        }

        private static MessageConfiguration CreateRabbitMqConfiguration()
        {
            return new MessageConfiguration
            {
                RabbitMqConfiguration = new RabbitMqConfiguration
                {
                    // The LMT backup/restore queues are deliberately absent: this host registers no
                    // consumers for those message types, and binding them would let it win messages
                    // that only LmtColdArchiveRestoreWorker can actually handle. Same for the Azure
                    // queue list below — see the note there.
                    ConsumerSubscriptions = [ConsumerSubscription.BindToQueue(IdentifierQueueName),
                                             ConsumerSubscription.BindToQueue(GenericMigrationQueue),
                                             ConsumerSubscription.BindToQueue(DataCleanupQueue),
                                             ConsumerSubscription.BindToQueue(MigrationCompletionTopic),],
                }
            };
        }

        private static MessageConfiguration CreateAzureServiceBusConfiguration()
        {
            return new MessageConfiguration
            {
                AzureServiceBusConfiguration = new AzureServiceBusConfiguration
                {
                    // Declaring a queue here attaches a receiver to it, and a Service Bus queue has
                    // competing consumers: exactly one host gets each message. With the LMT queues
                    // listed, blocks-os-worker won restore messages, found no IConsumer for the
                    // type, logged "No consumer found for message type ColdRestoreMessage" and
                    // completed them anyway — losing the work, and only appearing to function when
                    // that host happened to be stopped.
                    //
                    // Api still publishes to those queues: SendToConsumerAsync names the queue on
                    // each ConsumerMessage, so sending never needed them declared. This mirrors
                    // ReleaseProjectDeleteQueue above, which is published to and likewise unbound.
                    Queues = [IdentifierQueueName, GenericMigrationQueue, DataCleanupQueue],
                    Topics = [MigrationCompletionTopic]
                }
            };
        }
    }
}
