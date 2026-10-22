// Vite's `?raw` imports (the HTML clipboard fixtures), for the type checker.
declare module '*?raw' {
  const text: string;
  export default text;
}
