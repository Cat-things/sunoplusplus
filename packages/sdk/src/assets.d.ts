// Plugins can import a CSS file next to their code as a string and pass it to ctx.addStyle.
declare module '*.css' {
  const css: string
  export default css
}
