namespace Configuration.DomainService.Mail.Template.Services
{
    public interface IMailTemplateHtmlChecker
    {
        /// <summary>The first reason <paramref name="html"/> may not be saved as a template body, or null.</summary>
        string? FindProblem(string? html);
    }
}
