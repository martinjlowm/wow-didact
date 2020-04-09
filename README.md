# Didact

This project is based off of tstirrat's proof of concept Didact implementation.


# Usage

1. Add `"didact": "github:martinjlowm/wow-didact"` to `devDependencies`

2. Run `npm i` to install

3. Reference the JSX transformer as follows (ontop of your existing TypeScript
   and TypeScriptToLua configuration).

```json
{
  "compilerOptions": {
    "jsxFactory": "Didact.createElement",
    "jsx": "react",
    "plugins": [
      { "transform": "didact/src/transformer.ts" }
    ]
  }
}
```
