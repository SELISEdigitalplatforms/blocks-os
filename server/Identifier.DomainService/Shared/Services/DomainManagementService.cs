using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography.X509Certificates;
using System.Text.Json;
using System.Text.RegularExpressions;
using Blocks.Genesis;
using DnsClient;
using DomainService.Projects;
using DomainService.Shared.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;
using Renci.SshNet;

namespace DomainService.Shared
{
    public class DomainManagementService : IDomainManagementService
    {
        private readonly ILogger<DomainManagementService> _logger;
        private readonly IBlocksSecret _blocksSecret;
        private readonly IProjectRepository _projectRepository;
        private readonly ITenants _tenants;
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;

        // Domain names are interpolated into sudo shell commands on the reverse
        // proxy, so anything outside a strict hostname grammar is rejected before
        // it can reach one.
        private static readonly Regex HostnameRegex = new(
            @"^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$",
            RegexOptions.Compiled,
            TimeSpan.FromSeconds(1));

        public DomainManagementService(ILogger<DomainManagementService> logger,
                                       IBlocksSecret blocksSecret,
                                       IProjectRepository projectRepository,
                                       HttpClient httpClient,
                                       ITenants tenants,
                                       IConfiguration configuration)
        {
            _logger = logger;
            _blocksSecret = blocksSecret;
            _projectRepository = projectRepository;
            _tenants = tenants;
            _httpClient = httpClient;
            _configuration = configuration;
        }

        public async Task<BaseResponse> ConfigureDomainAsync(ConfigureDomainRequest request)
        {
            var tenantId = BlocksContext.GetContext()?.TenantId ?? string.Empty;
            _logger.LogInformation("Processing request {RequestId} for domain {Domain}", tenantId, request.CookieDomain);
            // Despite the field name, callers send the site host here — the vhost
            // this run provisions ("app.example.com", or a bare "example.com" when
            // the application is served from the apex).
            var domain = NormalizeDomain(request.CookieDomain);

            if (!IsValidHostname(domain))
            {
                _logger.LogWarning("Rejected invalid domain {Domain}", request.CookieDomain);
                return new BaseResponse { IsSuccess = false, Errors = new Dictionary<string, string> { { "invalid_domain", $"{request.CookieDomain} is not a valid domain name." } } };
            }

            var existingApplication = _tenants.GetTenantByID(tenantId)?.Applications?
                .FirstOrDefault(a => NormalizeDomain(a.Domain) == domain);

            var blocksApiDomain = BuildBlocksApiDomain(domain, existingApplication?.CookieDomain);

            // Derived from config (CnameRecordDomain), so a missing or malformed
            // setting must not produce a hostname either
            if (!IsValidHostname(blocksApiDomain))
            {
                _logger.LogError("Derived blocksapi domain {BlocksApiDomain} is not a valid hostname; check the CnameRecordDomain setting", blocksApiDomain);
                return new BaseResponse { IsSuccess = false, Errors = new Dictionary<string, string> { { "invalid_domain", $"Could not derive a valid API domain from {domain}." } } };
            }

            // Already-verified domains have their nginx config and certificate in
            // place — skip the DNS/SSH/certbot pipeline instead of re-running it
            if (existingApplication?.IsDomainVerified == true)
            {
                _logger.LogInformation("Domain {Domain} is already verified; skipping configuration", domain);
                return new BaseResponse { IsSuccess = true };
            }

            var (verifySuccess, verifyMessage) = await VerifyDomainAsync(domain);

            if (!verifySuccess)
            {
                _logger.LogWarning($"Domain verification failed for domain {domain}: {verifyMessage}");
                return new BaseResponse { IsSuccess = false, Errors = new Dictionary<string, string> { { "domain_verification_failed", $"{domain} - {verifyMessage}"}}};
            }

            var (verifyBlocksDomainSuccess, verifyBlocksDomainMessage) = await VerifyDomainAsync(blocksApiDomain);

            if (!verifyBlocksDomainSuccess)
            {
                _logger.LogWarning($"Domain verification failed for domain {blocksApiDomain}: {verifyMessage}");
                return new BaseResponse { IsSuccess = false, Errors = new Dictionary<string, string> { { "domain_verification_failed", $"{blocksApiDomain} - {verifyBlocksDomainMessage}"}}};
            }

            var (nginxSuccess, nginxMessage) = await UpdateNginxConfigAndSetupSslRemoteAsync(domain, blocksApiDomain);

            if (!nginxSuccess)
            {
                _logger.LogError("Nginx configuration failed: {Message}", nginxMessage);
                return new BaseResponse { IsSuccess = false, Errors = new Dictionary<string, string> { { "nginx_configuration_failed", nginxMessage } } };
            }

            _logger.LogInformation("Successfully configured domain {Domain}", request.CookieDomain);
            await UpdateDomainValidationStatusAsync(tenantId, domain, true);

            return new BaseResponse { IsSuccess = true };
        }

        // Domains are stored inconsistently ("https://x", "x", trailing slash,
        // mixed case) — normalize before comparing
        private static string NormalizeDomain(string? domain) =>
            (domain ?? string.Empty)
                .Trim()
                .Replace("https://", string.Empty, StringComparison.OrdinalIgnoreCase)
                .Replace("http://", string.Empty, StringComparison.OrdinalIgnoreCase)
                .TrimEnd('/')
                .ToLowerInvariant();

        private static bool IsValidHostname(string domain) =>
            !string.IsNullOrWhiteSpace(domain)
            && domain.Length <= 253
            && HostnameRegex.IsMatch(domain);

        private async Task UpdateDomainValidationStatusAsync(string tenantId, string domain, bool status)
        {
            var project = _tenants.GetTenantByID(tenantId);

            if (project is not null)
            {
                var normalizedDomain = NormalizeDomain(domain);
                var application = project.Applications?
                    .FirstOrDefault(a => NormalizeDomain(a.Domain) == normalizedDomain);

                if (application is null)
                {
                    _logger.LogWarning("No application found with domain {Domain} for tenant {TenantId}; verification status not updated", domain, tenantId);
                    return;
                }

                application.IsDomainVerified = status;
                await _projectRepository.UpdateProjectAsync(project);
                await _tenants.UpdateTenantVersionAsync(new TenantCacheUpdateMessage
                {
                    Action = "upsert",
                    TenantId = project.TenantId,
                    Tenant = project
                });
            }
        }


        private async Task<(bool, string)> VerifyDomainAsync(string domain)
        {
            _logger.LogInformation("Verifying domain {Domain}", domain);

            try
            {
                var dnsResolver = new LookupClient();
                var result = await dnsResolver.QueryAsync(domain, QueryType.A);

                if (!result.Answers.Any())
                {
                    _logger.LogWarning("No CNAME records found for {Domain}", domain);
                    return (false, "No A records found.");
                }

                _logger.LogInformation("Domain {Domain} verified successfully", domain);
                return (true, "Domain verified.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Domain verification failed for {Domain}", domain);
                return (false, $"Domain verification error: {ex.Message}");
            }
        }
        

        private async Task<(bool Success, string Message)> CheckPingBlocksApi(string domain)
        {
            var url = $"https://{domain}/release/v4/auth/testping";
            _logger.LogInformation("Checking blocksapi ping: {Url}", url);

            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Get, url);
                // If you want to ignore SSL cert errors like verify=False, you'd need a custom HttpClientHandler (not recommended in prod)

                var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);
                _logger.LogInformation("Blocksapi ping response status code: {StatusCode}", (int)response.StatusCode);

                if (response.StatusCode == HttpStatusCode.OK)
                {
                    return (true, "Ping successful.");
                }
                else
                {
                    return (false, $"Ping failed with status code {(int)response.StatusCode}.");
                }
            }
            catch (HttpRequestException ex)
            {
                _logger.LogWarning(ex, "Blocksapi ping request failed.");
                return (false, $"Ping request exception: {ex.Message}");
            }
            catch (TaskCanceledException ex) // Timeout, etc.
            {
                _logger.LogWarning(ex, "Blocksapi ping request timed out.");
                return (false, "Ping request timed out.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error during blocksapi ping.");
                return (false, $"Unexpected error: {ex.Message}");
            }
        }

        private async Task<(bool, string)> UpdateNginxConfigAndSetupSslRemoteAsync(string domain, string blocksApiDomain)
        {
            var host = _blocksSecret.SshHost;
            var username = _blocksSecret.SshUsername;
            var password = _blocksSecret.SshPassword;

            // Only hosts created by *this* run may be rolled back. The blocksapi host
            // is shared by every app under the same root domain, so if it was already
            // on the box it belongs to other apps: rolling it back would take them down.
            var createdDomains = new List<string>();

            _logger.LogInformation("Connecting to SSH server {Host}...", host);

            using var sshClient = new SshClient(host, username, password);

            try
            {
                sshClient.Connect();
                if (!sshClient.IsConnected)
                {
                    _logger.LogError("Failed to connect to SSH server {Host}", host);
                    return (false, "SSH connection failed.");
                }

                _logger.LogInformation("SSH connected to {Host}", host);

                // Diagnostic only. A 502/503 here means the API host is unhealthy, which
                // is an ops problem — it must never be read as "not configured yet", or a
                // transient blip would send us into the first-time-setup path and clobber
                // a live vhost.
                var (pingSuccess, pingMessage) = await CheckPingBlocksApi(blocksApiDomain);
                _logger.LogInformation("Blocksapi health for {Domain}: {Healthy} ({Message})", blocksApiDomain, pingSuccess, pingMessage);

                var targets = new[]
                {
                    (Domain: blocksApiDomain, Template: IdentifierConstants.RemoteBlocksapiTemplate, Placeholder: "blocksapi-domain"),
                    (Domain: domain, Template: IdentifierConstants.RemoteFeTemplate, Placeholder: "fe-domain"),
                };

                foreach (var target in targets)
                {
                    if (await IsTlsConfiguredAsync(sshClient, target.Domain))
                    {
                        _logger.LogInformation("{Domain} already has a TLS-enabled nginx vhost; leaving it untouched", target.Domain);
                        continue;
                    }

                    var (writeOk, _) = await ExecuteRemoteCommands(sshClient, UpdateNginxConfigCommands(target.Domain, target.Template, target.Placeholder));
                    createdDomains.Add(target.Domain);

                    if (!writeOk)
                    {
                        // The failing command and its stderr are already logged by
                        // ExecuteRemoteCommands; callers get a short message they can show.
                        _logger.LogError("Failed to update nginx config for domain {Domain}", target.Domain);
                        await RollbackAsync(sshClient, createdDomains);
                        return (false, $"Failed to update nginx config for domain {target.Domain}.");
                    }

                    _logger.LogInformation("Wrote nginx config for domain {Domain}", target.Domain);
                }

                if (createdDomains.Count == 0)
                {
                    _logger.LogInformation("Both {Domain} and {BlocksApiDomain} are already configured; nothing to do", domain, blocksApiDomain);
                    return (true, "Domains already configured.");
                }

                var (reloadOk, _) = await ExecuteRemoteCommands(sshClient, ReloadNginxConfigCommands());
                if (!reloadOk)
                {
                    _logger.LogError("Failed to reload nginx");
                    await RollbackAsync(sshClient, createdDomains);
                    return (false, "Failed to reload nginx configuration.");
                }

                _logger.LogInformation("Updated nginx config successfully for domains {Domains}", string.Join(",", createdDomains));

                foreach (var item in createdDomains)
                {
                    var (certOk, _) = await ExecuteRemoteCommands(sshClient, SSLCertificateInstallCommands(item));
                    if (!certOk)
                    {
                        // Certbot's full output is in the ExecuteRemoteCommands log line and in
                        // /var/log/letsencrypt on the proxy — it is far too long to hand back.
                        _logger.LogError("Failed to install SSL certificate for domain {Domain}", item);
                        await RollbackAsync(sshClient, createdDomains);
                        return (false, $"Failed to install SSL certificate for domain {item}.");
                    }
                    _logger.LogInformation("SSL certificate installed successfully for domain {Domain}", item);
                }

                return (true, "All commands executed successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SSH execution error");

                if (sshClient.IsConnected)
                {
                    await RollbackAsync(sshClient, createdDomains);
                }

                return (false, "Failed to reach the domain configuration server.");
            }
            finally
            {
                if (sshClient.IsConnected)
                {
                    sshClient.Disconnect();
                    _logger.LogInformation("Disconnected from SSH server {Host}", host);
                }
            }
        }

        // Certbot rewrites the vhost in place to add the 443 server block, so a vhost
        // carrying an ssl_certificate directive is already serving HTTPS. Re-copying the
        // plain-HTTP template over it would strip TLS from a live host. This checks the
        // one path this code owns and writes deterministically — unlike
        // /etc/letsencrypt/live/<domain>, whose lineage directory picks up a -0001 suffix
        // when a lineage of that name already exists.
        private async Task<bool> IsTlsConfiguredAsync(SshClient sshClient, string domain)
        {
            var vhost = $"/etc/nginx/sites-available/{domain}";

            // Anchored so a commented-out ssl_certificate line in the source template
            // cannot be mistaken for a certbot-installed one
            return await RemoteCheckAsync(
                sshClient,
                $"sudo test -f '{vhost}' && sudo grep -qE '^[[:space:]]*ssl_certificate[[:space:]]' '{vhost}'");
        }

        // A non-zero exit is an answer here, not a failure, so this stays out of
        // ExecuteRemoteCommands (which treats non-zero as fatal).
        private async Task<bool> RemoteCheckAsync(SshClient sshClient, string command)
        {
            _logger.LogInformation("Checking: {Command}", command);
            using var cmd = sshClient.CreateCommand(command);
            await cmd.ExecuteAsync();
            return cmd.ExitStatus == 0;
        }

        private async Task RollbackAsync(SshClient sshClient, List<string> createdDomains)
        {
            if (createdDomains.Count == 0)
            {
                return;
            }

            _logger.LogWarning("Rolling back nginx config for domains created by this run: {Domains}", string.Join(",", createdDomains));

            var (ok, message) = await ExecuteRemoteCommands(sshClient, CleanupNginxConfigCommands(createdDomains));
            if (!ok)
            {
                _logger.LogError("Rollback failed: {Message}", message);
            }
        }

        private async Task<(bool, string)> ExecuteRemoteCommands(SshClient sshClient, IEnumerable<string> commands)
        {
            foreach (var command in commands)
            {
                _logger.LogInformation("Executing: {Command}", command);
                using var cmd = sshClient.CreateCommand(command);
                await cmd.ExecuteAsync();

                if (cmd.ExitStatus != 0)
                {
                    _logger.LogError("Command failed: {Command}. Error: {Error}", command, cmd.Error);
                    return (false, $"Command failed: {command}. Error: {cmd.Error}");
                }
            }
            return (true, "All commands executed successfully.");
        }

        private async Task<(bool, string)> ExecuteRemoteCommandsAsync(IEnumerable<string> commands)
        {
            var host = _blocksSecret.SshHost;
            var username = _blocksSecret.SshUsername;
            var password = _blocksSecret.SshPassword;

            _logger.LogInformation("Connecting to SSH server {Host}...", host);

            using var sshClient = new SshClient(host, username, password);

            try
            {
                sshClient.Connect();
                if (!sshClient.IsConnected)
                {
                    _logger.LogError("Failed to connect to SSH server {Host}", host);
                    return (false, "SSH connection failed.");
                }

                _logger.LogInformation("SSH connected to {Host}", host);

                foreach (var command in commands)
                {
                    _logger.LogInformation("Executing: {Command}", command);
                    using var cmd = sshClient.CreateCommand(command);
                    await cmd.ExecuteAsync();

                    if (cmd.ExitStatus != 0)
                    {
                        _logger.LogError("Command failed: {Command}. Error: {Error}", command, cmd.Error);
                        return (false, $"Command failed: {command}. Error: {cmd.Error}");
                    }
                }

                return (true, "All commands executed successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SSH execution error");
                return (false, $"SSH error: {ex.Message}");
            }
            finally
            {
                if (sshClient.IsConnected)
                {
                    sshClient.Disconnect();
                    _logger.LogInformation("Disconnected from SSH server {Host}", host);
                }
            }
        }

        // The API host is always the CNAME label placed directly under the
        // application's cookie domain — "blocksapi.example.com" for both
        // "app.example.com" and a bare "example.com". This used to overwrite the
        // site host's first label instead, which ate the registrable name on an
        // apex host and asked DNS for hosts like "blocksapi.com".
        private string BuildBlocksApiDomain(string domain, string? storedCookieDomain)
        {
            var recordedCookieDomain = NormalizeDomain(storedCookieDomain);
            var cookieDomain = IdentifierHelper.ResolveCookieDomain(domain, recordedCookieDomain);

            if (recordedCookieDomain.Length > 0 && cookieDomain != recordedCookieDomain)
            {
                _logger.LogWarning("Cookie domain {CookieDomain} on record does not cover {Domain}; deriving the API host from the domain itself", recordedCookieDomain, domain);
            }

            return $"{_configuration["CnameRecordDomain"]}.{cookieDomain}";
        }

        private List<string> UpdateNginxConfigCommands(string domain, string path, string placeholder)
        {
            return new List<string>  {
                $"sudo cp '{path}' '/etc/nginx/sites-available/{domain}'",
                $"sudo sed -i 's/{{{placeholder}}}/{domain}/g' '/etc/nginx/sites-available/{domain}'",
                $"sudo ln -sf '/etc/nginx/sites-available/{domain}' /etc/nginx/sites-enabled/",
            };
        }

        private List<string> ReloadNginxConfigCommands()
        {
            return new List<string>  {
                $"sudo nginx -t",
                $"sudo systemctl reload nginx",
            };
        }

        private List<string> SSLCertificateInstallCommands(string domain)
        {
            return new List<string>  {
                   // --cert-name pins the lineage to the domain, so a re-run updates
                   // /etc/letsencrypt/live/<domain> instead of spawning a <domain>-0001
                   // copy. --keep-until-expiring makes a non-interactive re-run reinstall
                   // an existing, unexpired cert rather than erroring on the
                   // reinstall/renew prompt it cannot answer.
                   $"sudo certbot --webroot -w {IdentifierConstants.CertbotWebrootPath} --installer nginx -d '{domain}' --cert-name '{domain}' --email {IdentifierConstants.CertbotEmail} --agree-tos --keep-until-expiring --redirect --non-interactive -v",
            };
        }

        // Removes nginx config only. Certificates are left in /etc/letsencrypt so a retry
        // reuses the existing lineage instead of burning Let's Encrypt duplicate-cert quota.
        private List<string> CleanupNginxConfigCommands(List<string> domains)
        {
            var commands = new List<string>();

            foreach (var domain in domains)
            {
                commands.AddRange(new[]
                {
                    $"sudo rm -f '/etc/nginx/sites-enabled/{domain}'",
                    $"sudo rm -f '/etc/nginx/sites-available/{domain}'",
                });
            }
            commands.AddRange(ReloadNginxConfigCommands());
            return commands;
        }


        public async Task<(bool, string)> DisableDomainBindingAsync(DisableDomainBindingRequest request)
        {
            var domain = NormalizeDomain(request.Domain);

            if (!IsValidHostname(domain))
            {
                _logger.LogWarning("Rejected invalid domain {Domain} for disable-domain-binding", request.Domain);
                return (false, $"{request.Domain} is not a valid domain name.");
            }

            // Only this app's own vhost and certificate lineage are removed. The blocksapi
            // host derived from the same root domain is shared with every other app under
            // it and must survive — which is why this targets exact paths rather than
            // globbing the filesystem for anything whose name contains the domain.
            var commands = new List<string>
            {
                $"sudo rm -f '/etc/nginx/sites-enabled/{domain}'",
                $"sudo rm -f '/etc/nginx/sites-available/{domain}'",
            };

            // The certificate outlives the binding unless the caller asked for it to go.
            // Keeping the lineage is what lets the same host be re-added without spending
            // one of Let's Encrypt's five weekly duplicate-certificate slots; deleting it
            // is the only way to stop renewals for a host that is never coming back.
            if (request.DeleteCertificate)
            {
                // Exits non-zero when no such lineage exists, which is not a failure here.
                commands.Add($"sudo certbot delete --cert-name '{domain}' --non-interactive || true");
            }

            commands.AddRange(ReloadNginxConfigCommands());

            var (success, _) = await ExecuteRemoteCommandsAsync(commands);
            await UpdateDomainValidationStatusAsync(request.ProjectId, domain, false);

            _logger.LogInformation("Disabled domain binding for {Domain} (certificate removed: {CertificateRemoved})", domain, request.DeleteCertificate);

            return success
                ? (true, $"Domain binding disabled for {domain}.")
                : (false, $"Failed to disable domain binding for {domain}.");
        }


    }
}
