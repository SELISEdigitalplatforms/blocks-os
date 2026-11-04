using System.Buffers;
using System.Globalization;
using System.Text;
using System.Text.Json;
using Blocks.Genesis;

namespace Configuration.DomainService.Webhooks;

/// <summary>
/// The JSON a receiver gets: <c>{"id","action","time","organizationId","data"}</c>. No tenant, user or trace id.
/// </summary>
public static class WebhookEventBody
{
    public const string TestAction = "webhook.test";
    public const string EventIdPrefix = "evt_";
    private const string EmptyData = "{}";

    public static string From(BlocksAction action)
    {
        ArgumentNullException.ThrowIfNull(action);
        return Build(action.Id, action.Action, action.Time, action.OrganizationId, action.DataJson);
    }

    public static string Build(string id, string action, DateTime time, string? organizationId, string? dataJson)
    {
        var buffer = new ArrayBufferWriter<byte>();
        using (var writer = new Utf8JsonWriter(buffer))
        {
            writer.WriteStartObject();
            writer.WriteString("id", id);
            writer.WriteString("action", action);
            writer.WriteString("time", ToUtc(time).ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", CultureInfo.InvariantCulture));
            if (string.IsNullOrWhiteSpace(organizationId))
            {
                writer.WriteNull("organizationId");
            }
            else
            {
                writer.WriteString("organizationId", organizationId);
            }

            writer.WritePropertyName("data");
            WriteData(writer, dataJson);
            writer.WriteEndObject();
        }

        return Encoding.UTF8.GetString(buffer.WrittenSpan);
    }

    /// <summary>A new event id in the Genesis form.</summary>
    public static string NewEventId() => EventIdPrefix + Guid.NewGuid().ToString("N");

    // The data is a JSON object; anything else (or broken JSON) is sent as {}.
    private static void WriteData(Utf8JsonWriter writer, string? dataJson)
    {
        try
        {
            using var document = JsonDocument.Parse(string.IsNullOrWhiteSpace(dataJson) ? EmptyData : dataJson);
            if (document.RootElement.ValueKind == JsonValueKind.Object)
            {
                document.RootElement.WriteTo(writer);
                return;
            }
        }
        catch (JsonException)
        {
            // Falls through to {}: a broken payload must not stop the delivery.
        }

        writer.WriteStartObject();
        writer.WriteEndObject();
    }

    private static DateTime ToUtc(DateTime time) => time.Kind switch
    {
        DateTimeKind.Utc => time,
        DateTimeKind.Local => time.ToUniversalTime(),
        _ => DateTime.SpecifyKind(time, DateTimeKind.Utc)
    };
}
