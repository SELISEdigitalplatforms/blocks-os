using Microsoft.Extensions.Configuration;

namespace Configuration.DomainService.DataGateway
{
    /// <summary>
    /// The os rollout switch <c>DataGateway:RootConfigEnabled</c> (env <c>DataGateway__RootConfigEnabled</c>),
    /// default <c>false</c> = today's DSC code paths (os SPEC2 §6.1). Read through <see cref="IConfiguration"/>
    /// on every call (no own cache); an env var still needs a rolling restart of os Api + Worker.
    /// The Identifier side (<c>ProjectRepository</c>) reads the same key itself.
    /// </summary>
    public class DataGatewayRootMode
    {
        public const string ConfigKey = "DataGateway:RootConfigEnabled";

        private readonly IConfiguration _configuration;

        public DataGatewayRootMode(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public virtual bool IsOn => _configuration.GetValue<bool>(ConfigKey);
    }
}
