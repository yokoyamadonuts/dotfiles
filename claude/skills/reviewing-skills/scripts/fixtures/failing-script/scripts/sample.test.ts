import { assertEquals } from "jsr:@std/assert";
Deno.test("sample: fails on purpose", () => {
  assertEquals(1 + 1, 3);
});
