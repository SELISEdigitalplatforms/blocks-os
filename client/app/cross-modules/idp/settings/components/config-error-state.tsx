type ConfigErrorStateProps = {
  message?: string;
};

export const ConfigErrorState = ({
  message = "Unable to load configuration. Check that the IAM API is reachable and you are signed in.",
}: ConfigErrorStateProps) => (
  <p className="text-sm text-destructive" role="alert">
    {message}
  </p>
);
