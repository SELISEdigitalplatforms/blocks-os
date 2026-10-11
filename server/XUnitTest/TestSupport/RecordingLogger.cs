using System;
using System.Collections.Generic;
using Microsoft.Extensions.Logging;

namespace XUnitTest.TestSupport
{
    /// <summary>
    /// Keeps every formatted log entry, so a test can assert both that something was logged and
    /// that a value which must never reach a log — a secret reference, say — was not.
    /// </summary>
    public sealed class RecordingLogger<T> : ILogger<T>
    {
        public List<(LogLevel Level, string Message)> Entries { get; } = new();

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter) =>
            Entries.Add((logLevel, formatter(state, exception)));
    }
}
