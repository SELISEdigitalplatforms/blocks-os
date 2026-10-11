using System.Collections.Concurrent;
using System.Net;
using System.Net.Sockets;
using Blocks.Genesis;
using Microsoft.Extensions.Logging;

namespace DomainService.Shared
{
    // Guided custom-domain setup: the records a customer has to create, and a variant of the
    // configure pipeline that reports each step as it finishes. It sits beside
    // ConfigureDomainAsync, which stays as it is until this path replaces it.
    public partial class DomainManagementService
    {
        private const string DefaultApiHostLabel = "blocksapi";
        private const string CnameTargetSetting = "FrontendRuntime:BLOCKS_CNAME_BASE_URL";

        // Hosts with a setup run in progress. The proxy is shared, so two overlapping runs for
        // the same vhost would race each other's nginx writes, certbot runs and rollbacks. This
        // is per API instance: across instances, certbot's own lock is the only guard.
        private static readonly ConcurrentDictionary<string, byte> SetupsInProgress = new(StringComparer.Ordinal);

        public async Task<DomainSetupGuideResponse> GetDomainSetupGuideAsync()
        {
            var tenantId = BlocksContext.GetContext()?.TenantId ?? string.Empty;
            var tenant = _tenants.GetTenantByID(tenantId);

            if (tenant is null)
            {
                _logger.LogWarning("No tenant {TenantId} found while building the domain setup guide", tenantId);
                return new DomainSetupGuideResponse { IsSuccess = false, Errors = new Dictionary<string, string> { { "project_not_found", "The project could not be found." } } };
            }

            var cnameTarget = NormalizeDomain(_configuration[CnameTargetSetting]);
            var apexIpAddress = await ResolveIpv4Async(cnameTarget);
            var defaultApiBaseUrl = $"https://{DefaultApiHostLabel}{_configuration["KbtclIdentifier"]}";

            var applications = (tenant.Applications ?? new List<Applications>())
                .Where(a => !string.IsNullOrWhiteSpace(a.Domain))
                .Select(a => BuildSetupGuideItem(a, cnameTarget, apexIpAddress, defaultApiBaseUrl))
                .ToList();

            return new DomainSetupGuideResponse { IsSuccess = true, Applications = applications };
        }

        public async Task<BaseResponse> ConfigureDomainWithProgressAsync(ConfigureDomainRequest request, Func<DomainSetupProgress, Task> onProgress)
        {
            var tenantId = BlocksContext.GetContext()?.TenantId ?? string.Empty;
            // Same contract as Domain/Configure: the field carries the site host.
            var domain = NormalizeDomain(request?.CookieDomain);

            if (!IsValidHostname(domain))
            {
                _logger.LogWarning("Rejected invalid domain {Domain} for guided setup", request?.CookieDomain);
                return SetupError("invalid_domain", $"{request?.CookieDomain} is not a valid domain name.");
            }

            // Unlike the original endpoint, only a domain registered on this project is
            // provisioned: the run writes vhosts and spends Let's Encrypt quota on a shared proxy.
            var application = _tenants.GetTenantByID(tenantId)?.Applications?
                .FirstOrDefault(a => NormalizeDomain(a.Domain) == domain);

            if (application is null)
            {
                _logger.LogWarning("Domain {Domain} is not registered on tenant {TenantId}; guided setup refused", domain, tenantId);
                return SetupError("domain_not_found", $"{domain} is not registered on this project.");
            }

            var blocksApiDomain = BuildBlocksApiDomain(domain, application.CookieDomain);

            if (!IsValidHostname(blocksApiDomain))
            {
                _logger.LogError("Derived blocksapi domain {BlocksApiDomain} is not a valid hostname; check the CnameRecordDomain setting", blocksApiDomain);
                return SetupError("invalid_domain", $"Could not derive a valid API domain from {domain}.");
            }

            if (application.IsDomainVerified)
            {
                _logger.LogInformation("Domain {Domain} is already verified; skipping guided setup", domain);
                return new BaseResponse { IsSuccess = true };
            }

            var lockedHosts = new[] { domain, blocksApiDomain }.Distinct().ToArray();

            if (!TryBeginSetup(lockedHosts))
            {
                _logger.LogWarning("Guided setup for {Domain} is already running", domain);
                return SetupError("setup_in_progress", $"Setup for {domain} is already running. Wait for it to finish, then try again.");
            }

            try
            {
                if (!await RunDnsStepAsync(DomainSetupSteps.AppDns, domain, onProgress))
                {
                    return SetupError("domain_verification_failed", $"No DNS record found for {domain}.");
                }

                if (!await RunDnsStepAsync(DomainSetupSteps.ApiDns, blocksApiDomain, onProgress))
                {
                    return SetupError("domain_verification_failed", $"No DNS record found for {blocksApiDomain}.");
                }

                await ReportAsync(onProgress, new DomainSetupProgress(DomainSetupSteps.Ssl, DomainSetupStepStatus.Running));

                var (sslSuccess, sslMessage) = await UpdateNginxConfigAndSetupSslRemoteAsync(domain, blocksApiDomain);

                if (!sslSuccess)
                {
                    _logger.LogError("Guided setup failed while securing {Domain}: {Message}", domain, sslMessage);
                    await ReportAsync(onProgress, new DomainSetupProgress(DomainSetupSteps.Ssl, DomainSetupStepStatus.Failed, Message: sslMessage));
                    return SetupError("nginx_configuration_failed", sslMessage);
                }

                await UpdateDomainValidationStatusAsync(tenantId, domain, true);
                await ReportAsync(onProgress, new DomainSetupProgress(DomainSetupSteps.Ssl, DomainSetupStepStatus.Done));

                _logger.LogInformation("Guided setup configured domain {Domain}", domain);
                return new BaseResponse { IsSuccess = true };
            }
            finally
            {
                EndSetup(lockedHosts);
            }
        }

        private async Task<bool> RunDnsStepAsync(string step, string host, Func<DomainSetupProgress, Task> onProgress)
        {
            await ReportAsync(onProgress, new DomainSetupProgress(step, DomainSetupStepStatus.Running, host));

            var (verified, verifyMessage) = await VerifyDomainAsync(host);

            if (!verified)
            {
                _logger.LogWarning("Guided setup DNS check failed for {Host}: {Message}", host, verifyMessage);
                await ReportAsync(onProgress, new DomainSetupProgress(step, DomainSetupStepStatus.Failed, host, $"No DNS record found for {host}."));
                return false;
            }

            await ReportAsync(onProgress, new DomainSetupProgress(step, DomainSetupStepStatus.Done, host));
            return true;
        }

        // A listener that has gone away (the browser closed the stream) must never stop the
        // run halfway: the proxy would be left with a vhost and no certificate.
        private async Task ReportAsync(Func<DomainSetupProgress, Task> onProgress, DomainSetupProgress progress)
        {
            try
            {
                await onProgress(progress);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not report guided setup progress {Step}/{Status}", progress.Step, progress.Status);
            }
        }

        private DomainSetupGuideItem BuildSetupGuideItem(Applications application, string cnameTarget, string? apexIpAddress, string defaultApiBaseUrl)
        {
            var host = NormalizeDomain(application.Domain);
            var domainType = application.DomainType == DomainType.Unspecified
                ? IdentifierHelper.ResolveDomainType(host)
                : application.DomainType;

            var item = new DomainSetupGuideItem
            {
                Domain = application.Domain,
                CookieDomain = application.CookieDomain ?? string.Empty,
                IsDomainVerified = application.IsDomainVerified,
                IsPlatformDomain = domainType == DomainType.PlatformSubdomain,
            };

            if (item.IsPlatformDomain)
            {
                item.ApiBaseUrl = defaultApiBaseUrl;
                return item;
            }

            var blocksApiDomain = BuildBlocksApiDomain(host, application.CookieDomain);
            item.ApiBaseUrl = $"https://{blocksApiDomain}";

            if (!IsValidHostname(host) || !IsValidHostname(blocksApiDomain))
            {
                return item;
            }

            var zone = IdentifierHelper.GetRegistrableDomain(host);
            item.IsApex = host == zone;

            item.Records.Add(item.IsApex
                ? new DnsRecordInstruction
                {
                    Purpose = "app",
                    // An A record needs an address; if the target could not be resolved just
                    // now, an ALIAS to the target host is the only record that still works.
                    Type = apexIpAddress is null ? "ALIAS" : "A",
                    Name = "@",
                    Host = host,
                    Value = apexIpAddress ?? cnameTarget,
                }
                : new DnsRecordInstruction
                {
                    Purpose = "app",
                    Type = "CNAME",
                    Name = RelativeRecordName(host, zone),
                    Host = host,
                    Value = cnameTarget,
                });

            item.Records.Add(new DnsRecordInstruction
            {
                Purpose = "api",
                Type = "CNAME",
                Name = RelativeRecordName(blocksApiDomain, zone),
                Host = blocksApiDomain,
                Value = cnameTarget,
            });

            return item;
        }

        private static string RelativeRecordName(string host, string zone)
        {
            if (host == zone)
            {
                return "@";
            }

            var suffix = $".{zone}";
            return host.EndsWith(suffix, StringComparison.Ordinal) ? host[..^suffix.Length] : host;
        }

        private async Task<string?> ResolveIpv4Async(string host)
        {
            if (string.IsNullOrWhiteSpace(host))
            {
                return null;
            }

            try
            {
                var addresses = await Dns.GetHostAddressesAsync(host, AddressFamily.InterNetwork);
                return addresses
                    .Select(address => address.ToString())
                    .OrderBy(address => address, StringComparer.Ordinal)
                    .FirstOrDefault();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not resolve an IPv4 address for CNAME target {Host}", host);
                return null;
            }
        }

        private static bool TryBeginSetup(string[] hosts)
        {
            var claimed = new List<string>();

            foreach (var host in hosts)
            {
                if (!SetupsInProgress.TryAdd(host, 0))
                {
                    EndSetup(claimed.ToArray());
                    return false;
                }

                claimed.Add(host);
            }

            return true;
        }

        private static void EndSetup(string[] hosts)
        {
            foreach (var host in hosts)
            {
                SetupsInProgress.TryRemove(host, out _);
            }
        }

        private static BaseResponse SetupError(string code, string message) =>
            new() { IsSuccess = false, Errors = new Dictionary<string, string> { { code, message } } };
    }
}
