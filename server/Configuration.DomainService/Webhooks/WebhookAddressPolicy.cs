using System.Net;
using System.Net.Sockets;

namespace Configuration.DomainService.Webhooks;

/// <summary>
/// Which IP addresses a webhook may reach: public unicast only. Blocks loopback, private, link-local (cloud metadata
/// 169.254.169.254 included), CGNAT, ULA, multicast, documentation, reserved and transition ranges; an IPv4-mapped
/// IPv6 address is judged by its IPv4 form.
/// </summary>
public static class WebhookAddressPolicy
{
    private static readonly (IPAddress Network, int Prefix)[] BlockedV4 =
    [
        Range("0.0.0.0/8"),
        Range("10.0.0.0/8"),
        Range("100.64.0.0/10"),
        Range("127.0.0.0/8"),
        Range("169.254.0.0/16"),
        Range("172.16.0.0/12"),
        Range("192.0.0.0/24"),
        Range("192.0.2.0/24"),
        Range("192.88.99.0/24"),
        Range("192.168.0.0/16"),
        Range("198.18.0.0/15"),
        Range("198.51.100.0/24"),
        Range("203.0.113.0/24"),
        Range("224.0.0.0/4"),
        Range("240.0.0.0/4")
    ];

    private static readonly (IPAddress Network, int Prefix)[] BlockedV6 =
    [
        Range("::/96"),
        Range("64:ff9b::/96"),
        Range("64:ff9b:1::/48"),
        Range("100::/64"),
        Range("2001::/23"),
        Range("2001:db8::/32"),
        Range("2002::/16"),
        Range("fc00::/7"),
        Range("fe80::/10"),
        Range("fec0::/10"),
        Range("ff00::/8")
    ];

    public static bool IsPublic(IPAddress address)
    {
        ArgumentNullException.ThrowIfNull(address);
        if (address.IsIPv4MappedToIPv6)
        {
            return IsPublic(address.MapToIPv4());
        }

        return address.AddressFamily switch
        {
            AddressFamily.InterNetwork => !BlockedV4.Any(r => InRange(address, r.Network, r.Prefix)),
            AddressFamily.InterNetworkV6 => !BlockedV6.Any(r => InRange(address, r.Network, r.Prefix)),
            _ => false
        };
    }

    // CIDR text ("10.0.0.0/8") to network and prefix length.
    private static (IPAddress Network, int Prefix) Range(string cidr)
    {
        var slash = cidr.IndexOf('/', StringComparison.Ordinal);
        return (IPAddress.Parse(cidr[..slash]), int.Parse(cidr[(slash + 1)..], System.Globalization.CultureInfo.InvariantCulture));
    }

    private static bool InRange(IPAddress address, IPAddress network, int prefix)
    {
        var bytes = address.GetAddressBytes();
        var networkBytes = network.GetAddressBytes();
        var fullBytes = prefix / 8;
        for (var i = 0; i < fullBytes; i++)
        {
            if (bytes[i] != networkBytes[i])
            {
                return false;
            }
        }

        var remainingBits = prefix % 8;
        if (remainingBits == 0)
        {
            return true;
        }

        var mask = (byte)(0xFF << (8 - remainingBits));
        return (bytes[fullBytes] & mask) == (networkBytes[fullBytes] & mask);
    }
}
