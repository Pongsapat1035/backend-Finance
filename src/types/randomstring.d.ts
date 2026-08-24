declare module 'randomstring' {
  interface GenerateOptions {
    length?: number;
    charset?: string;
    capitalization?: 'lowercase' | 'uppercase';
  }

  function generate(options?: number | GenerateOptions): string;
}
