using Azure.Messaging.ServiceBus;
using Blocks.Genesis;
using MongoDB.Bson;
using MongoDB.Driver;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using SeliseBlocks.LMT.Client;
using StackExchange.Redis;
using System.Collections.Concurrent;
using System.Text;
using System.Text.Json;

namespace LmtManagedServiceWorker
 {
 public class LmtMessage
  {
  public string Type { get; set; } = string.Empty;
  public string ServiceName { get; set; } = string.Empty;
  public JsonElement Data { get; set; }
  }

 public class Service
  {
  public string ServiceId { get; set; } = string.Empty;
  }

 public class LmtWorker : BackgroundService
  {
  private readonly ILogger<LmtWorker> _logger;
  private readonly ICacheClient _cacheClient;
  private readonly IMongoDatabase _database;
  private readonly IMongoDatabase _logDatabase;
  private readonly IMongoDatabase _tracesDatabase;
  private readonly string _serviceActivityChannel;
  private readonly ConcurrentDictionary<string, Service> _serviceCache = new();

  private readonly string _lmtMessageConnectionString;
  private readonly bool _isRabbitMq;

  // Azure
  private readonly ServiceBusClient? _serviceBusClient;
  private readonly ConcurrentDictionary<string, ServiceBusProcessor> _logsProcessors = new();
  private readonly ConcurrentDictionary<string, ServiceBusProcessor> _tracesProcessors = new();

  // RabbitMQ
  private readonly ConnectionFactory? _rabbitMqFactory;
  private IConnection? _rabbitMqConnection;
  private readonly ConcurrentDictionary<string, IChannel> _rabbitMqLogChannels = new();
  private readonly ConcurrentDictionary<string, IChannel> _rabbitMqTraceChannels = new();
  private readonly ConcurrentDictionary<string, string> _rabbitMqLogConsumerTags = new();
  private readonly ConcurrentDictionary<string, string> _rabbitMqTraceConsumerTags = new();

  private bool _isSubscribed;
  private bool _disposed;

  public LmtWorker ( ILogger<LmtWorker> logger, ICacheClient cacheClient, IBlocksSecret blocksSecret )
   {
   _logger = logger;
   _cacheClient = cacheClient;
   _database = new MongoClient(blocksSecret.DatabaseConnectionString).GetDatabase(blocksSecret.RootDatabaseName);
   _logDatabase = new MongoClient(blocksSecret.LogConnectionString).GetDatabase(blocksSecret.LogDatabaseName);
   _tracesDatabase = new MongoClient(blocksSecret.TraceConnectionString).GetDatabase(blocksSecret.TraceDatabaseName);

   _serviceActivityChannel = "service::activity";
   _lmtMessageConnectionString = blocksSecret.LmtMessageConnectionString;
   _isRabbitMq = IsRabbitMq(_lmtMessageConnectionString);

   if (_isRabbitMq)
    {
    _rabbitMqFactory = new ConnectionFactory
     {
     Uri = new Uri(_lmtMessageConnectionString),
     AutomaticRecoveryEnabled = true,
     NetworkRecoveryInterval = TimeSpan.FromSeconds(10),
     ClientProvidedName = "seliseblocks-lmt-worker"
     };
    }
   else
    {
    _serviceBusClient = new ServiceBusClient(_lmtMessageConnectionString);
    }
   }

  protected override async Task ExecuteAsync ( CancellationToken stoppingToken )
   {
   if (_isRabbitMq)
    {
    await EnsureRabbitMqConnectionAsync();
    }

   LoadServicesFromDb();
   await SubscribeToServiceActivityAsync();

   _logger.LogInformation(
       "LMT Worker started with transport {Transport} - listening for service activity on Redis channel {Channel}",
       _isRabbitMq ? "RabbitMQ" : "AzureServiceBus",
       _serviceActivityChannel);

   while (!stoppingToken.IsCancellationRequested)
    {
    await Task.Delay(1000, stoppingToken);
    }
   }

  private async Task SubscribeToServiceActivityAsync ( )
   {
   if (_isSubscribed) return;

   try
    {
    await _cacheClient.SubscribeAsync(_serviceActivityChannel, HandleServiceActivity);
    _isSubscribed = true;
    _logger.LogInformation("Successfully subscribed to Redis channel {Channel}", _serviceActivityChannel);
    }
   catch (Exception ex)
    {
    _logger.LogError(ex, "Failed to subscribe to Redis channel {Channel}", _serviceActivityChannel);
    }
   }

  private void HandleServiceActivity ( RedisChannel channel, RedisValue message )
   {
   try
    {
    var update = JsonSerializer.Deserialize<ServiceUpdateMessage>(message.ToString());
    if (update == null || string.IsNullOrWhiteSpace(update.ServiceId))
     {
     _logger.LogWarning("Invalid service activity message");
     return;
     }

    if (update.Action == "add")
     {
     _serviceCache.TryAdd(update.ServiceId, new Service { ServiceId = update.ServiceId });

     if (_isRabbitMq)
      {
      StartRabbitMqConsumer(update.ServiceId, isLogs: true);
      StartRabbitMqConsumer(update.ServiceId, isLogs: false);
      }
     else
      {
      StartAzureProcessor(update.ServiceId, LmtConstants.LogSubscription, _logsProcessors);
      StartAzureProcessor(update.ServiceId, LmtConstants.TraceSubscription, _tracesProcessors);
      }

     _logger.LogInformation("Added service {ServiceId} and started consumers", update.ServiceId);
     }
    else if (update.Action == "remove")
     {
     _serviceCache.TryRemove(update.ServiceId, out _);

     if (_isRabbitMq)
      {
      StopRabbitMqConsumer(update.ServiceId, isLogs: true);
      StopRabbitMqConsumer(update.ServiceId, isLogs: false);
      }
     else
      {
      StopAzureProcessor(update.ServiceId, _logsProcessors);
      StopAzureProcessor(update.ServiceId, _tracesProcessors);
      }

     _logger.LogInformation("Removed service {ServiceId} and stopped consumers", update.ServiceId);
     }
    }
   catch (Exception ex)
    {
    _logger.LogError(ex, "Error handling service activity message");
    }
   }

  private void LoadServicesFromDb ( )
   {
   try
    {
    var services = _database
        .GetCollection<BsonDocument>("BlocksManagedServices")
        .Find(FilterDefinition<BsonDocument>.Empty)
        .ToList()
        .Select(doc => new Service { ServiceId = doc["ServiceId"].AsString })
        .ToList();

    foreach (var service in services)
     {
     _serviceCache.TryAdd(service.ServiceId, service);

     if (_isRabbitMq)
      {
      StartRabbitMqConsumer(service.ServiceId, isLogs: true);
      StartRabbitMqConsumer(service.ServiceId, isLogs: false);
      }
     else
      {
      StartAzureProcessor(service.ServiceId, LmtConstants.LogSubscription, _logsProcessors);
      StartAzureProcessor(service.ServiceId, LmtConstants.TraceSubscription, _tracesProcessors);
      }
     }

    _logger.LogInformation("Loaded {Count} services from DB and started consumers", services.Count);
    }
   catch (Exception ex)
    {
    _logger.LogError(ex, "Failed to load services from DB");
    }
   }

  // -------------------------
  // Azure Service Bus
  // -------------------------

  private void StartAzureProcessor (
      string serviceId,
      string subscription,
      ConcurrentDictionary<string, ServiceBusProcessor> processors )
   {
   if (_serviceBusClient == null)
    throw new InvalidOperationException("Azure Service Bus client is not initialized.");

   if (processors.ContainsKey(serviceId))
    return;

   var processor = _serviceBusClient.CreateProcessor(
       LmtConstants.GetTopicName(serviceId),
       subscription,
       new ServiceBusProcessorOptions
        {
        MaxConcurrentCalls = 2,
        AutoCompleteMessages = false,
        PrefetchCount = 20
        });

   processor.ProcessMessageAsync += ProcessAzureMessageAsync;
   processor.ProcessErrorAsync += ProcessAzureErrorAsync;
   processor.StartProcessingAsync().GetAwaiter().GetResult();

   processors.TryAdd(serviceId, processor);
   _logger.LogInformation("Started Azure processor for {ServiceId} on {Subscription}", serviceId, subscription);
   }

  private void StopAzureProcessor ( string serviceId, ConcurrentDictionary<string, ServiceBusProcessor> processors )
   {
   if (processors.TryRemove(serviceId, out var processor))
    {
    processor.StopProcessingAsync().GetAwaiter().GetResult();
    processor.DisposeAsync().GetAwaiter().GetResult();
    _logger.LogInformation("Stopped Azure processor for {ServiceId}", serviceId);
    }
   }

  private async Task ProcessAzureMessageAsync ( ProcessMessageEventArgs args )
   {
   try
    {
    var message = args.Message;

    var messageType = message.ApplicationProperties.TryGetValue("type", out var typeValue)
        ? typeValue?.ToString()
        : null;

    var serviceName = message.ApplicationProperties.TryGetValue("serviceName", out var serviceValue)
        ? serviceValue?.ToString()
        : null;

    var source = message.ApplicationProperties.TryGetValue("source", out var sourceValue)
        ? sourceValue?.ToString()
        : null;

    if (string.IsNullOrWhiteSpace(messageType) || string.IsNullOrWhiteSpace(serviceName))
     {
     _logger.LogWarning("Missing required Azure message properties. MessageId: {MessageId}", message.MessageId);
     await args.CompleteMessageAsync(message);
     return;
     }

    var body = message.Body.ToString();

    await ProcessLmtPayloadAsync(
        body,
        messageType,
        serviceName,
        source ?? "AzureServiceBus",
        message.MessageId);

    await args.CompleteMessageAsync(message);
    }
   catch (Exception ex)
    {
    _logger.LogError(ex, "Error processing Azure LMT message. MessageId: {MessageId}", args.Message.MessageId);
    await args.AbandonMessageAsync(args.Message, new Dictionary<string, object> { ["retryCount"] = 3 });
    }
   }

  private Task ProcessAzureErrorAsync ( ProcessErrorEventArgs args )
   {
   _logger.LogError(args.Exception, "Azure Service Bus error: {ErrorSource}", args.ErrorSource);
   return Task.CompletedTask;
   }

  // -------------------------
  // RabbitMQ
  // -------------------------

  private async Task EnsureRabbitMqConnectionAsync ( )
   {
   if (_rabbitMqFactory == null)
    throw new InvalidOperationException("RabbitMQ factory is not initialized.");

   if (_rabbitMqConnection is { IsOpen: true })
    return;

   _rabbitMqConnection?.Dispose();
   _rabbitMqConnection = await _rabbitMqFactory.CreateConnectionAsync();
   }

  private void StartRabbitMqConsumer ( string serviceId, bool isLogs )
   {
   var channelMap = isLogs ? _rabbitMqLogChannels : _rabbitMqTraceChannels;
   var consumerTagMap = isLogs ? _rabbitMqLogConsumerTags : _rabbitMqTraceConsumerTags;

   if (channelMap.ContainsKey(serviceId))
    {
    _logger.LogInformation("RabbitMQ consumer already exists for {ServiceId}, isLogs={IsLogs}", serviceId, isLogs);
    return;
    }

   try
    {
    EnsureRabbitMqConnectionAsync().GetAwaiter().GetResult();

    if (_rabbitMqConnection == null)
     throw new InvalidOperationException("RabbitMQ connection is not initialized.");

    var channel = _rabbitMqConnection.CreateChannelAsync().GetAwaiter().GetResult();

    var exchangeName = LmtWorkerConstants.GetRabbitMqExchangeName(serviceId);
    var queueName = GetRabbitMqQueueName(serviceId, isLogs);
    var routingKey = isLogs ? LmtWorkerConstants.RabbitMqLogsRoutingKey : LmtWorkerConstants.RabbitMqTracesRoutingKey;

    _logger.LogInformation("Declaring exchange {Exchange}, queue {Queue}, routingKey {RoutingKey}", exchangeName, queueName, routingKey);

    channel.ExchangeDeclareAsync(
        exchange: exchangeName,
        type: ExchangeType.Direct,
        durable: true,
        autoDelete: false).GetAwaiter().GetResult();

    channel.QueueDeclareAsync(
        queue: queueName,
        durable: true,
        exclusive: false,
        autoDelete: false).GetAwaiter().GetResult();

    channel.QueueBindAsync(
        queue: queueName,
        exchange: exchangeName,
        routingKey: routingKey).GetAwaiter().GetResult();

    channel.BasicQosAsync(prefetchSize: 0, prefetchCount: 20, global: false).GetAwaiter().GetResult();

    var consumer = new AsyncEventingBasicConsumer(channel);
    consumer.ReceivedAsync += async ( _, ea ) =>
    {
     await ProcessRabbitMqMessageAsync(serviceId, channel, ea);
    };

    var consumerTag = channel.BasicConsumeAsync(
        queue: queueName,
        autoAck: false,
        consumer: consumer).GetAwaiter().GetResult();

    channelMap.TryAdd(serviceId, channel);
    consumerTagMap.TryAdd(serviceId, consumerTag);

    _logger.LogInformation(
        "Started RabbitMQ consumer for {ServiceId}, queue={QueueName}, consumerTag={ConsumerTag}, isLogs={IsLogs}",
        serviceId, queueName, consumerTag, isLogs);
    }
   catch (Exception ex)
    {
    _logger.LogError(ex, "Failed to start RabbitMQ consumer for {ServiceId}, isLogs={IsLogs}", serviceId, isLogs);
    }
   }

  private void StopRabbitMqConsumer ( string serviceId, bool isLogs )
   {
   var channelMap = isLogs ? _rabbitMqLogChannels : _rabbitMqTraceChannels;
   var consumerTagMap = isLogs ? _rabbitMqLogConsumerTags : _rabbitMqTraceConsumerTags;

   if (consumerTagMap.TryRemove(serviceId, out var consumerTag) &&
       channelMap.TryRemove(serviceId, out var channel))
    {
    if (channel.IsOpen)
     {
     channel.BasicCancelAsync(consumerTag).GetAwaiter().GetResult();
     }

    channel.Dispose();
    _logger.LogInformation("Stopped RabbitMQ consumer for {ServiceId}", serviceId);
    }
   }

  private async Task ProcessRabbitMqMessageAsync ( string serviceId, IChannel channel, BasicDeliverEventArgs ea )
   {
   string? messageId = null;

   try
    {
    messageId = ea.BasicProperties?.MessageId ?? string.Empty;

    var headers = ea.BasicProperties?.Headers;
    var messageType = GetRabbitMqHeaderValue(headers, "type") ?? ea.BasicProperties?.Type;
    var serviceName = GetRabbitMqHeaderValue(headers, "serviceName") ?? serviceId;
    var source = GetRabbitMqHeaderValue(headers, "source") ?? "RabbitMQ";

    if (string.IsNullOrWhiteSpace(messageType) || string.IsNullOrWhiteSpace(serviceName))
     {
     _logger.LogWarning("Missing required RabbitMQ message properties. MessageId: {MessageId}", messageId);
     await channel.BasicAckAsync(ea.DeliveryTag, false);
     return;
     }

    var body = Encoding.UTF8.GetString(ea.Body.ToArray());

    await ProcessLmtPayloadAsync(
        body,
        messageType,
        serviceName,
        source,
        messageId ?? string.Empty);

    await channel.BasicAckAsync(ea.DeliveryTag, false);
    }
   catch (Exception ex)
    {
    _logger.LogError(ex, "Error processing RabbitMQ LMT message. MessageId: {MessageId}", messageId);
    await channel.BasicNackAsync(ea.DeliveryTag, false, requeue: true);
    }
   }

  private static string GetRabbitMqQueueName ( string serviceId, bool isLogs )
   {
   return isLogs
       ? $"lmt-{serviceId}-logs-worker"
       : $"lmt-{serviceId}-traces-worker";
   }

  private static string? GetRabbitMqHeaderValue ( IDictionary<string, object?>? headers, string key )
   {
   if (headers == null || !headers.TryGetValue(key, out var value) || value == null)
    return null;

   return value switch
    {
     byte[] bytes => Encoding.UTF8.GetString(bytes),
     ReadOnlyMemory<byte> rom => Encoding.UTF8.GetString(rom.ToArray()),
     _ => value.ToString()
     };
   }

  private static bool IsRabbitMq ( string? connectionString )
   {
   if (string.IsNullOrWhiteSpace(connectionString))
    return false;

   if (!Uri.TryCreate(connectionString, UriKind.Absolute, out var uri))
    return false;

   return uri.Scheme.Equals("amqp", StringComparison.OrdinalIgnoreCase) ||
          uri.Scheme.Equals("amqps", StringComparison.OrdinalIgnoreCase);
   }

  // -------------------------
  // Common processing
  // -------------------------

  private async Task ProcessLmtPayloadAsync (
      string body,
      string messageType,
      string serviceName,
      string source,
      string messageId )
   {
   var lmtMessage = JsonSerializer.Deserialize<LmtMessage>(body);

   if (lmtMessage == null)
    {
    _logger.LogWarning("Invalid LMT message body. MessageId: {MessageId}", messageId);
    return;
    }

   if (lmtMessage.Data.ValueKind == JsonValueKind.Undefined ||
       lmtMessage.Data.ValueKind == JsonValueKind.Null)
    {
    _logger.LogWarning("Missing or null Data property. MessageId: {MessageId}", messageId);
    return;
    }

   if (messageType == "logs")
    {
    var logs = JsonSerializer.Deserialize<List<LogData>>(lmtMessage.Data.GetRawText());
    if (logs != null && logs.Count > 0)
     {
     await SaveLogsToMongoDBAsync(serviceName, logs);
     _logger.LogInformation(
         "Saved {Count} logs for service {ServiceName} from {Source}. MessageId: {MessageId}",
         logs.Count,
         serviceName,
         source,
         messageId);
     }
    }
   else if (messageType == "traces")
    {
    var tenantBatches = JsonSerializer.Deserialize<Dictionary<string, List<TraceData>>>(lmtMessage.Data.GetRawText());
    if (tenantBatches != null && tenantBatches.Count > 0)
     {
     await SaveTracesToMongoDBAsync(tenantBatches);
     var totalTraces = tenantBatches.Sum(x => x.Value.Count);

     _logger.LogInformation(
         "Saved {Count} traces for service {ServiceName} from {Source}. MessageId: {MessageId}",
         totalTraces,
         serviceName,
         source,
         messageId);
     }
    }
   else
    {
    _logger.LogWarning("Unknown message type: {Type}. MessageId: {MessageId}", messageType, messageId);
    }
   }

  private async Task SaveLogsToMongoDBAsync ( string serviceName, List<LogData> logs )
   {
   await LmtMongoPersistence.SaveLogsAsync(
       _logDatabase,
       serviceName,
       logs,
       ConvertLogToBsonDocument,
       _logger);
   }

  private async Task SaveTracesToMongoDBAsync ( Dictionary<string, List<TraceData>> tenantBatches )
   {
   await LmtMongoPersistence.SaveTenantBatchesAsync(
       _tracesDatabase,
       tenantBatches,
       ConvertTraceToBsonDocument,
       _logger);
   }

  private static BsonDocument ConvertLogToBsonDocument ( LogData logData )
   {
   return LmtMongoPersistence.CreateLogDocument(
       logData.Timestamp,
       logData.Level,
       logData.Message,
       logData.Exception,
       logData.ServiceName,
       logData.TenantId,
       logData.Properties);
   }

  private static BsonDocument ConvertTraceToBsonDocument ( TraceData traceData )
   {
   return LmtMongoPersistence.CreateTraceDocument(traceData);
   }

  public override async Task StopAsync ( CancellationToken cancellationToken )
   {
   if (_isSubscribed)
    {
    try
     {
     await _cacheClient.UnsubscribeAsync(_serviceActivityChannel);
     _logger.LogInformation("Unsubscribed from Redis channel {Channel}", _serviceActivityChannel);
     }
    catch (Exception ex)
     {
     _logger.LogError(ex, "Error unsubscribing from Redis channel {Channel}", _serviceActivityChannel);
     }
    }

   foreach (var processor in _logsProcessors.Values)
    {
    await processor.StopProcessingAsync(cancellationToken);
    await processor.DisposeAsync();
    }

   foreach (var processor in _tracesProcessors.Values)
    {
    await processor.StopProcessingAsync(cancellationToken);
    await processor.DisposeAsync();
    }

   foreach (var channel in _rabbitMqLogChannels.Values)
    {
    await channel.CloseAsync();
    channel.Dispose();
    }

   foreach (var channel in _rabbitMqTraceChannels.Values)
    {
    await channel.CloseAsync();
    channel.Dispose();
    }

   if (_serviceBusClient != null)
    {
    await _serviceBusClient.DisposeAsync();
    }

   if (_rabbitMqConnection != null)
    {
    await _rabbitMqConnection.CloseAsync();
    _rabbitMqConnection.Dispose();
    }

   _logger.LogInformation("LMT Worker stopped");
   }

  public override void Dispose ( )
   {
   if (_disposed) return;
   _disposed = true;
   base.Dispose();
   }
  }

 public class ServiceUpdateMessage
  {
  public string Action { get; set; } = string.Empty;
  public string ServiceId { get; set; } = string.Empty;
  }
 public static class LmtWorkerConstants
  {
  public const string RabbitMqLogsRoutingKey = "logs";
  public const string RabbitMqTracesRoutingKey = "traces";

  public static string GetRabbitMqExchangeName ( string serviceName )
   {
   return "lmt-" + serviceName;
   }
  }
 }
