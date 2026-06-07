declare module "bun:test" {
  export function test(name: string, callback: () => void | Promise<void>): void;
  interface Matchers {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toThrow(expected?: unknown): void;
    toContain(expected: unknown): void;
    toContainEqual(expected: unknown): void;
    toHaveLength(expected: number): void;
    not: Matchers;
  }

  export function expect(actual: unknown): Matchers;
}

declare module "node:url" {
  export function fileURLToPath(url: string | URL): string;
}

declare const Bun: {
  build(options: {
    entrypoints: string[];
    outdir: string;
    target: "browser";
    sourcemap: "external";
  }): Promise<{
    success: boolean;
    logs: unknown[];
  }>;
  file(url: URL): Blob & {
    exists(): Promise<boolean>;
  };
  serve(options: {
    port: number;
    fetch(request: Request): Response | Promise<Response>;
  }): unknown;
};
