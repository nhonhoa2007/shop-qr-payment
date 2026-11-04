export function createLatestAsyncGuard<T>() {
  let latest = 0;

  return {
    run(
      task: () => Promise<T>,
      onSuccess: (value: T) => void,
      onError: (error: unknown) => void = () => {},
      onSettled: () => void = () => {},
    ): Promise<void> {
      const current = ++latest;
      return Promise.resolve()
        .then(task)
        .then((value) => { if (current === latest) onSuccess(value); })
        .catch((error) => { if (current === latest) onError(error); })
        .finally(() => { if (current === latest) onSettled(); });
    },
    invalidate(): void {
      latest += 1;
    },
  };
}
