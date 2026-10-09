export type Support = { name: string; url: string | null; line: string | null };

/**
 * The small print under a partner advert. It uses the age the visitor must be and the help organisation for their
 * region, so a US visitor reads "21+" and a US help line, not "18+" and a UK charity.
 */
export function advertDisclosure(minAge: number, support: Support): string {
  const host = support.url ? new URL(support.url).hostname.replace(/^www\./, "") : support.name;
  return `Advertisement. ${minAge}+. T&Cs apply. Help: ${host}${support.line ? `. ${support.line}` : ""}`;
}
