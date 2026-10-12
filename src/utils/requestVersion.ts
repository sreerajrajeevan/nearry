/** Invalidates async work after account changes or provider disposal. */
export class RequestVersion {
  private value = 0;
  next() {
    return ++this.value;
  }
  current(version: number) {
    return version === this.value;
  }
  invalidate() {
    this.value++;
  }
}
