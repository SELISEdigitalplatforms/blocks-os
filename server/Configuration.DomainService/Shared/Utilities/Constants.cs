using Blocks.Genesis;

namespace Configuration.DomainService.Shared.Utilities
{
    public static class Constants
    {
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
            if (Uri.TryCreate(messageConnectionString, UriKind.Absolute, out var uri) &&
                (uri.Scheme.Equals("amqp", StringComparison.OrdinalIgnoreCase) ||
                 uri.Scheme.Equals("amqps", StringComparison.OrdinalIgnoreCase)))
            {
                return RabbitMqProvider;
            }

            return DefaultProvider;
        }

        private static MessageConfiguration CreateRabbitMqConfiguration()
        {
            return new MessageConfiguration
            {
                RabbitMqConfiguration = new RabbitMqConfiguration
                {
                    ConsumerSubscriptions = [],
                }
            };
        }

        private static MessageConfiguration CreateAzureServiceBusConfiguration()
        {
            return new MessageConfiguration
            {
                AzureServiceBusConfiguration = new AzureServiceBusConfiguration
                {
                    Queues = [],
                    Topics = []
                }
            };
        }

        public const string AuthenticationQueue = "blocks_authentication_listener";
        public const string DefaultMfaTemplateName = "MfaViaEmail";
        public const string DefaultMfaTemplateId = "0b121378-3c3d-44f3-a855-9da08cbef48c";
        public const string StorageQueue = "blocks_storage_listener";

        /// <summary>
        /// Carries <c>BuiltInNotificationConfigurationChangedEvent</c> from Api to blocks-os-worker. The worker
        /// is the only host that binds it (see <see cref="WithNotificationConfigurationQueue"/>).
        /// </summary>
        public const string NotificationConfigurationQueue = "blocks_os_notification_config_listener";

        public const string OnlyRootTenantCanManageBuiltInNotificationConfiguration = "Only_Root_Tenant_Can_Manage_Built_In_Notification_Configuration";
        public const string BuiltInNotificationConfigurationIsReadOnly = "Built_In_Notification_Configuration_Is_Read_Only";
        public const string NotificationConfigurationCannotBeDisabled = "Notification_Configuration_Cannot_Be_Disabled";
        public const string NotificationConfigurationPropagationNotQueued = "Notification_Configuration_Propagation_Not_Queued";

        // Receivers, channels and push message of a notification configuration. Each key has a message in the client's
        // NOTIFICATION_CONFIG_ERROR_MESSAGES map.
        public const string OnlyRootTenantCanSetDefaultAudience = "Only_Root_Tenant_Can_Set_Default_Audience";
        public const string NotificationAudienceIsLocked = "Notification_Audience_Is_Locked";
        public const string NotificationAudienceNotAllowed = "Notification_Audience_Not_Allowed";
        public const string NotificationGrantScopeUnavailable = "Notification_Grant_Scope_Unavailable";
        public const string NotificationSendToInvalid = "Notification_Send_To_Invalid";
        public const string NotificationAudienceInvalid = "Notification_Audience_Invalid";
        public const string NotificationAudienceListTooLong = "Notification_Audience_List_Too_Long";
        public const string NotificationAudienceItemTooLong = "Notification_Audience_Item_Too_Long";
        public const string NotificationFilterContextRequired = "Notification_Filter_Context_Required";
        public const string NotificationChannelRequired = "Notification_Channel_Required";
        public const string NotificationPushKeysRequired = "Notification_Push_Keys_Required";
        public const string NotificationRateLimitOutOfRange = "Notification_Rate_Limit_Out_Of_Range";

        /// <summary>Adds the notification-config queue to a worker's message configuration (Rabbit or Azure).</summary>
        public static MessageConfiguration WithNotificationConfigurationQueue(MessageConfiguration configuration)
        {
            if (configuration.RabbitMqConfiguration is { } rabbit &&
                !rabbit.ConsumerSubscriptions.Any(s => s.QueueName == NotificationConfigurationQueue))
            {
                rabbit.ConsumerSubscriptions.Add(ConsumerSubscription.BindToQueue(NotificationConfigurationQueue));
            }

            if (configuration.AzureServiceBusConfiguration is { } azure &&
                !azure.Queues.Contains(NotificationConfigurationQueue))
            {
                azure.Queues = [.. azure.Queues, NotificationConfigurationQueue];
            }

            return configuration;
        }
        private const string DefaultProvider = "azure";
        private const string RabbitMqProvider = "rabbitmq";
    }
}

