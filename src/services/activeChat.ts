let active: { id: string; ticket: symbol } | null = null;
export function setActiveChat(id: string) {
  const ticket = Symbol();
  active = { id, ticket };
  return () => {
    if (active?.ticket === ticket) active = null;
  };
}
export function isActiveChat(id: unknown) {
  return typeof id === "string" && active?.id === id;
}
