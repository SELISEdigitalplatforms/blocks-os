namespace DomainService.People
{
    public interface IUserRepository
    {
        Task<User> GetUserByEmailAsync(string email);
    }
}