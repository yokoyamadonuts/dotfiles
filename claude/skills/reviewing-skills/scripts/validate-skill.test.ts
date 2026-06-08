import { assertEquals } from "jsr:@std/assert";
import { parseFrontmatter } from "./validate-skill.ts";

Deno.test("parseFrontmatter: extracts object frontmatter and body", () => {
  const r = parseFrontmatter(
    "---\nname: foo\ndescription: bar\n---\n# Body\ntext",
  );
  assertEquals(r.ok, true);
  if (r.ok) {
    assertEquals(r.frontmatter.name, "foo");
    assertEquals(r.body, "# Body\ntext");
  }
});

Deno.test("parseFrontmatter: missing block fails", () => {
  const r = parseFrontmatter("# No frontmatter\njust text");
  assertEquals(r.ok, false);
});

Deno.test("parseFrontmatter: invalid YAML fails", () => {
  const r = parseFrontmatter("---\nname: : :\n  - broken\n---\n");
  assertEquals(r.ok, false);
});

Deno.test("parseFrontmatter: non-object frontmatter fails", () => {
  const r = parseFrontmatter("---\n- just\n- a\n- list\n---\nbody");
  assertEquals(r.ok, false);
});
