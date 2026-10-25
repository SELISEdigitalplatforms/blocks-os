using FluentAssertions;
using MongoDB.Driver;
using Os.DataAccess;
using Xunit;

namespace XUnitTest.Services;

/// <summary>ReadScope.ForView: a Genesis column mask applied to typed entities returned to the API caller.</summary>
public class ReadScopeForViewTests
{
    public sealed class Inner
    {
        public string? Secret { get; set; }
        public string? Shown { get; set; }
    }

    public sealed class Sample
    {
        public string Id { get; set; } = "s1";
        public string? Name { get; set; }
        public string? Body { get; set; }
        public int Count { get; set; }
        public string Label { get; set; } = "default-label";
        public Inner? Inner { get; set; }
    }

    private static Sample Stored() => new()
    {
        Name = "Welcome", Body = "Hi", Count = 7, Label = "stored-label",
        Inner = new Inner { Secret = "s", Shown = "x" },
    };

    /// <summary>A mask that nulls the given top-level properties and Inner.Secret, as Genesis does for hidden columns.</summary>
    private static ReadScope<Sample> Scope(params string[] hidden) => new(true, FilterDefinition<Sample>.Empty, null, row =>
    {
        foreach (var name in hidden) row[name] = null!;
        if (row.TryGetValue("Inner", out var inner) && inner is IDictionary<string, object> nested) nested["Secret"] = null!;
        return row;
    });

    [Fact]
    public void HiddenProperties_ReadAsUnset_AndEverythingElseStaysAsStored()
    {
        var view = Scope("Body", "Count", "Label").ForView(Stored());

        view.Body.Should().BeNull();
        view.Count.Should().Be(0);                     // a hidden number is its default, not an error
        view.Label.Should().Be("default-label");        // and a hidden text with an initializer is the initializer
        view.Inner!.Secret.Should().BeNull();
        (view.Name, view.Inner.Shown).Should().Be(("Welcome", "x"));
    }

    private static Func<Dictionary<string, object>, Dictionary<string, object>> Hides(params string[] hidden) => row =>
    {
        foreach (var name in hidden) row[name] = null!;
        if (row.TryGetValue("Inner", out var inner) && inner is IDictionary<string, object> nested) nested["Secret"] = null!;
        return row;
    };

    [Fact]
    public void KeepHidden_SavingWhatTheMaskedReadShowed_KeepsTheStoredValues()
    {
        var stored = Stored();
        var shown = Scope("Body", "Count").ForView(Stored());
        shown.Name = "Welcome back";                       // the one change the caller made

        var saved = ColumnMask.KeepHidden(shown, stored, Hides("Body", "Count"));

        (saved.Name, saved.Body, saved.Count, saved.Inner!.Secret, saved.Inner.Shown).Should().Be(("Welcome back", "Hi", 7, "s", "x"));
    }

    [Fact]
    public void KeepHidden_AValueTheCallerSetThemselves_IsKept()
    {
        var update = Stored();
        update.Body = "A new body";
        update.Count = 9;

        var saved = ColumnMask.KeepHidden(update, Stored(), Hides("Body", "Count"));

        (saved.Body, saved.Count).Should().Be(("A new body", 9));
    }

    [Fact]
    public void KeepHidden_NothingHidden_ReturnsTheUpdateAsSent()
    {
        var update = Stored();
        update.Body = null;

        ColumnMask.KeepHidden(update, Stored(), row => row).Should().BeSameAs(update);
    }

    [Fact]
    public void WithoutAMask_TheEntityIsReturnedAsIs()
    {
        var stored = Stored();

        new ReadScope<Sample>(true, FilterDefinition<Sample>.Empty, null).ForView(stored).Should().BeSameAs(stored);
        new ReadScope<Sample>(true, FilterDefinition<Sample>.Empty, null).ForView([stored]).Should().ContainSingle().Which.Should().BeSameAs(stored);
    }

    [Fact]
    public void NothingHidden_KeepsTheSameInstance()
    {
        var stored = Stored();
        new ReadScope<Sample>(true, FilterDefinition<Sample>.Empty, null, row => row).ForView(stored).Should().BeSameAs(stored);
    }
}
