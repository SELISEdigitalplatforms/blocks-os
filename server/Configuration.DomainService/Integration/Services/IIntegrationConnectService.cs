using Configuration.DomainService.Integration.RequestModel;

namespace Configuration.DomainService.Integration.Services;

public interface IIntegrationConnectService
{
    Task<(CreateIntegrationRequestResponse? Response, Dictionary<string, string>? Errors)> CreateRequestAsync(CreateIntegrationRequest request, CancellationToken cancellationToken = default);

    Task<(GetIntegrationRequestResponse? Response, Dictionary<string, string>? Errors)> GetRequestAsync(string requestId, CancellationToken cancellationToken = default);

    Task<(CancelIntegrationRequestResponse? Response, Dictionary<string, string>? Errors)> CancelRequestAsync(CancelIntegrationRequest request, CancellationToken cancellationToken = default);

    Task<(ApproveIntegrationRequestResponse? Response, Dictionary<string, string>? Errors)> ApproveRequestAsync(ApproveIntegrationRequest request, CancellationToken cancellationToken = default);

    Task<(ExchangeIntegrationRequestResponse? Response, Dictionary<string, string>? Errors)> ExchangeAsync(ExchangeIntegrationRequest request, CancellationToken cancellationToken = default);
}
