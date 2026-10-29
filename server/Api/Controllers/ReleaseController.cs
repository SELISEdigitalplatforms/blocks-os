using Blocks.Genesis;
using Devops.DomainService.Deployment.Models.Request;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ReleaseDriver;

namespace BlocksOs.Api.Controllers
{
    /// <summary>
    /// Release and repository operations, served out of blocks-os. This is the move of what blocks-logic
    /// exposed as <c>logic/deployment/*</c>; the action names are kept identical so only the
    /// <c>logic/deployment</c> prefix changes to <c>os/release</c> for callers.
    /// </summary>
    [ApiController]
    [Route("[controller]/[action]")]
    public class ReleaseController(IReleaseDriverService releaseDriverService) : ControllerBase
    {
        [HttpGet]
        [ProtectedEndPoint("blocks-release::auth::authorization-status")]
        public async Task<BaseApiResponse> IsAuthorized()
        {
            return await releaseDriverService.IsAuthorizeAsync();
        }

        [HttpGet]
        [ProtectedEndPoint("blocks-release::auth::access-token")]
        public async Task<BaseApiResponse> AccessToken([FromQuery] string code)
        {
            return await releaseDriverService.GetAccessTokenAsync(code);
        }

        [HttpPost]
        [ProtectedEndPoint("blocks-release::auth::remove-authorization")]
        public async Task<BaseApiResponse> RemoveAuthorization()
        {
            return await releaseDriverService.RemoveAuthorizationAsync();
        }

        [HttpDelete]
        [ProtectedEndPoint("blocks-release::auth::delete-authorization")]
        public async Task<BaseApiResponse> DeleteAuthorization()
        {
            return await releaseDriverService.DeleteAuthorizationAsync();
        }

        [HttpGet]
        [ProtectedEndPoint("blocks-release::build::repos-list")]
        public async Task<BaseApiResponse> GetReposList()
        {
            return await releaseDriverService.GetReposListAsync();
        }

        [HttpGet]
        [ProtectedEndPoint("blocks-release::github::user")]
        public async Task<BaseApiResponse> GetUser()
        {
            return await releaseDriverService.GetUserAsync();
        }

        [HttpGet]
        [ProtectedEndPoint("blocks-release::github::repos")]
        public async Task<BaseApiResponse> GetRepos([FromQuery] string? Search, [FromQuery] int PageNumber = 1, [FromQuery] int PageSize = 30)
        {
            return await releaseDriverService.SearchRepositoriesAsync(Search, PageNumber, PageSize);
        }

        [HttpGet]
        [ProtectedEndPoint("blocks-release::github::branches")]
        public async Task<BaseApiResponse> GetBranches([FromQuery] string repo)
        {
            return await releaseDriverService.GetBranchesAsync(repo);
        }

        [HttpGet]
        [ProtectedEndPoint("blocks-release::github::branch-exists")]
        public async Task<BaseApiResponse> GithubBranchExists([FromQuery] string repoId)
        {
            return await releaseDriverService.GithubBranchExistsAsync(repoId);
        }

        [HttpPost]
        [ProtectedEndPoint("blocks-release::build::repo-domain-update")]
        public async Task<BaseApiResponse> UpdateRepoDomain([FromBody] RepoDomainUpdateRequest request)
        {
            return await releaseDriverService.UpdateRepoDomainAsync(request);
        }
    }
}
