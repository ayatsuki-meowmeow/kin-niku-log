import { defineConfig } from "orval";

export default defineConfig({
  api: {
    input: "../../openapi.yaml",
    output: {
      mode: "tags-split",
      target: "src/generated",
      schemas: "src/generated/model",
      client: "react-query",
      clean: true,
      override: {
        mutator: {
          path: "src/lib/fetcher.ts",
          name: "fetcher",
        },
      },
    },
  },
});
