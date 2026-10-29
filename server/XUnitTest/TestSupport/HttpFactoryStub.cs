using System;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;

namespace XUnitTest.TestSupport
{
    /// <summary>
    /// Builds an <see cref="IHttpClientFactory"/> over a canned response.
    /// </summary>
    /// <remarks>
    /// The service reads a configured certificate back over HTTP to describe it, so tests that do
    /// not care about certificates still need a factory that fails harmlessly, and the ones that
    /// do need to serve exact bytes.
    /// </remarks>
    public static class HttpFactoryStub
    {
        /// <summary>Serves <paramref name="content"/> for any request.</summary>
        public static IHttpClientFactory Serving(byte[] content) =>
            Build(new StubHandler(content, throws: false));

        /// <summary>Fails every request, as an unreachable blob would.</summary>
        public static IHttpClientFactory Unreachable() =>
            Build(new StubHandler([], throws: true));

        private static IHttpClientFactory Build(HttpMessageHandler handler)
        {
            // string.Empty, not "default": the service calls CreateClient() with no name, which
            // resolves Options.DefaultName -- an empty string. Registering the literal name
            // "default" leaves that call falling back to an unconfigured client.
            var services = new ServiceCollection();
            services.AddHttpClient(string.Empty).ConfigurePrimaryHttpMessageHandler(() => handler);
            return services.BuildServiceProvider().GetRequiredService<IHttpClientFactory>();
        }

        private sealed class StubHandler(byte[] content, bool throws) : HttpMessageHandler
        {
            protected override Task<HttpResponseMessage> SendAsync(
                HttpRequestMessage request,
                CancellationToken cancellationToken)
            {
                if (throws)
                {
                    throw new HttpRequestException("stubbed: blob unreachable");
                }

                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new ByteArrayContent(content)
                });
            }
        }
    }
}
