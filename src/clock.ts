const formatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function startClock(element: HTMLTimeElement): () => void {
  const update = (): void => {
    const now = new Date();
    element.textContent = formatter.format(now);
    element.dateTime = now.toISOString();
  };

  update();
  const intervalId = window.setInterval(update, 1_000);

  return () => window.clearInterval(intervalId);
}
