export class JellyfinHttpError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "JellyfinHttpError";
    this.status = status;
  }
}
