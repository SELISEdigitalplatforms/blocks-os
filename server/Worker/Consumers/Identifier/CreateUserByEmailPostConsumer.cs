using Blocks.Genesis;
using DomainService.Dtos;
using DomainService.People;

namespace Worker.Consumers.Identifier
{
    public class CreateUserByEmailPostConsumer : IConsumer<CreateUserByEmailPostEvent>
    {
        private readonly IPeopleService _peopleService;

        public CreateUserByEmailPostConsumer(IPeopleService peopleService)
        {
            _peopleService = peopleService;
        }

        public async Task Consume(CreateUserByEmailPostEvent context)
        {
            await _peopleService.SendProjectInvitationToNewUser(context);
        }
    }
}
