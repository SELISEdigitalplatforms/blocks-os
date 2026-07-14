using MongoDB.Bson;
using MongoDB.Driver;
using SeliseBlocks.LMT.Client;
using System;
using System.Collections.Generic;
using System.Text;
using System.Text.Json;

namespace Worker
{
 internal static class LmtMongoPersistence
 {
  internal static BsonDocument ConvertLogToBsonDocument(LogData logData)
  {
   return CreateLogDocument(
       logData.Timestamp,
       logData.Level,
       logData.Message,
       logData.Exception,
       logData.ServiceName,
       logData.TenantId,
       logData.Properties);
  }

  internal static BsonDocument ConvertTraceToBsonDocument(TraceData traceData)
  {
   return CreateTraceDocument(
       traceData.Timestamp,
       traceData.TraceId,
       traceData.SpanId,
       traceData.ParentSpanId,
       traceData.ParentId,
       traceData.Kind,
       traceData.ActivitySourceName,
       traceData.OperationName,
       traceData.StartTime,
       traceData.EndTime,
       traceData.Duration,
       traceData.Attributes,
       traceData.Status,
       traceData.StatusDescription,
       traceData.Baggage.ToDictionary(kvp => kvp.Key, kvp => (object)kvp.Value),
       traceData.ServiceName,
       traceData.TenantId);
  }

  internal static async Task SaveLogsAsync<TLog>(
      IMongoDatabase logDatabase,
      string serviceName,
      IEnumerable<TLog> logs,
      Func<TLog, BsonDocument> convert,
      ILogger logger)
  {
   var collection = logDatabase.GetCollection<BsonDocument>(serviceName);

   try
   {
    var bsonDocuments = logs.Select(convert).ToList();
    await collection.InsertManyAsync(bsonDocuments);
   }
   catch (Exception ex)
   {
    logger.LogError(ex, "Failed to insert log batch for service {ServiceName}", serviceName);
   }
  }

  internal static async Task SaveTenantBatchesAsync<TTrace>(
      IMongoDatabase tracesDatabase,
      Dictionary<string, List<TTrace>> tenantBatches,
      Func<TTrace, BsonDocument> convert,
      ILogger logger)
  {
   foreach (var tenantBatch in tenantBatches)
   {
    var collection = tracesDatabase.GetCollection<BsonDocument>(tenantBatch.Key);

    try
    {
     var bsonDocuments = tenantBatch.Value.Select(convert).ToList();
     await collection.InsertManyAsync(bsonDocuments);
    }
    catch (Exception ex)
    {
     logger.LogError(ex, "Failed to insert batch for tenant {TenantId}", tenantBatch.Key);
    }
   }
  }

  internal static BsonDocument CreateLogDocument(
      DateTime timestamp,
      string? level,
      string? message,
      string? exception,
      string? serviceName,
      string? tenantId,
      IDictionary<string, object>? properties)
  {
   var document = new BsonDocument
            {
                { "Timestamp", timestamp },
                { "Level", level ?? string.Empty },
                { "Message", message ?? string.Empty },
                { "Exception", exception ?? string.Empty },
                { "ServiceName", serviceName ?? string.Empty },
                { "TenantId", tenantId ?? string.Empty }
            };

   if (properties == null)
   {
    return document;
   }

   foreach (var property in properties)
   {
    try
    {
     document[property.Key] = ConvertPropertyToBsonValue(property.Value);
    }
    catch
    {
     document[property.Key] = property.Value?.ToString() ?? string.Empty;
    }
   }

   return document;
  }

  internal static BsonDocument CreateTraceDocument(
      DateTime timestamp,
      string traceId,
      string spanId,
      string? parentSpanId,
      string? parentId,
      string? kind,
      string? activitySourceName,
      string? operationName,
      DateTime startTime,
      DateTime endTime,
      double duration,
      IDictionary<string, object>? attributes,
      string? status,
      string? statusDescription,
      IDictionary<string, object>? baggage,
      string? serviceName,
      string? tenantId)
  {
   return new BsonDocument
            {
                { "Timestamp", timestamp },
                { "TraceId", traceId },
                { "SpanId", spanId },
                { "ParentSpanId", parentSpanId ?? string.Empty },
                { "ParentId", parentId ?? string.Empty },
                { "Kind", kind ?? string.Empty },
                { "ActivitySourceName", activitySourceName ?? string.Empty },
                { "OperationName", operationName ?? string.Empty },
                { "StartTime", startTime },
                { "EndTime", endTime },
                { "Duration", duration },
                {
                    "Attributes",
                    new BsonDocument((attributes ?? new Dictionary<string, object>()).ToDictionary(
                        kvp => kvp.Key,
                        kvp => ConvertPropertyToBsonValue(kvp.Value)))
                },
                { "Status", status ?? string.Empty },
                { "StatusDescription", statusDescription ?? string.Empty },
                {
                    "Baggage",
                    new BsonDocument((baggage ?? new Dictionary<string, object>()).ToDictionary(
                        kvp => kvp.Key,
                        kvp => ConvertPropertyToBsonValue(kvp.Value)))
                },
                { "ServiceName", serviceName ?? string.Empty },
                { "TenantId", tenantId ?? string.Empty }
            };
  }

  internal static BsonValue ConvertPropertyToBsonValue(object? value)
  {
   if (value is JsonElement jsonElement)
   {
    return jsonElement.ValueKind switch
    {
     JsonValueKind.String => jsonElement.GetString() ?? string.Empty,
     JsonValueKind.Number => jsonElement.TryGetInt64(out var l) ? l : jsonElement.GetDouble(),
     JsonValueKind.True => true,
     JsonValueKind.False => false,
     JsonValueKind.Null => BsonNull.Value,
     JsonValueKind.Array => new BsonArray(jsonElement.EnumerateArray().Select(e => ConvertPropertyToBsonValue(e))),
     JsonValueKind.Object => new BsonDocument(jsonElement.EnumerateObject().Select(p =>
         new BsonElement(p.Name, ConvertPropertyToBsonValue(p.Value)))),
     _ => jsonElement.GetRawText()
    };
   }

   return value switch
   {
    null => string.Empty,
    string str => str,
    int i => i,
    long l => l,
    double d => d,
    bool b => b,
    DateTime dt => dt,
    List<object> list => new BsonArray(list.Select(ConvertPropertyToBsonValue)),
    Dictionary<string, object> dict => new BsonDocument(dict.Select(kvp =>
        new BsonElement(kvp.Key, ConvertPropertyToBsonValue(kvp.Value)))),
    _ => value.ToString() ?? string.Empty
   };
  }
 }
}
