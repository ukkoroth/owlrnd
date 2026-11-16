/**
 * Public facts about the owlrnd site.
 *
 * url: the live site's address.
 * sourceUrl: where users can get the source code (AGPL-3.0 section 13 asks a network service to offer it).
 * Leave it null while the repository is private; once it is public, set it and the footer shows "Source code".
 */
export const site = {
  /** The public address; share images and other absolute links in page metadata resolve against it. */
  url: "https://owlrnd.com",
  sourceUrl: "https://github.com/ukkoroth/owlrnd" as string | null,
};
