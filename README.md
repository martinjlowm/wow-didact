# Didact

React-like UI rendering for widgets in WoW AddOns, based on tstirrat's
proof-of-concept Didact implementation.

## Usage

1. Add `"didact": "github:martinjlowm/wow-didact"` to `devDependencies`.

2. Run `npm i` to install.

3. Reference the JSX transformer as follows (on top of your existing TypeScript
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

## Architecture

The reconciler never names a WoW `Frame`. It talks to a `HostConfig<Node>`
(`src/host-config.ts`), the same seam `react-reconciler` exposes to custom
renderers, and two hosts implement it:

- `src/hosts/wow-host.ts` drives real frames in-game through `wow-utils`.
- `src/hosts/test-host.ts` is an in-memory node tree, so the UI can be modeled
  and asserted without a running client.

`createReconciler(host)` (`src/reconciler.ts`) binds the diffing algorithm to a
host and returns `render`. `didact.ts` wires the WoW host for shipping; the test
suite wires the in-memory host.

### Keyed reconciliation and why it matters here

Child diffing follows React's two-pass keyed algorithm from `ReactChildFiber.js`:
a child is reused when its `key` and element `type` both match, moves are
minimised with the `lastPlacedIndex` pivot, and unmatched old children are torn
down. A WoW frame is uncollectable once created, so an index-based diff that
rebuilt a list on every insert would leak a frame per render. Keyed reuse keeps
a frame's identity across renders and creates a new one only for a genuinely new
key. The `prepending a keyed child` fuzz case pins this: prepending one child
creates exactly the new subtree and rebuilds none of the shifted siblings.

## Testing

Three pillars back the reconciler.

- **TypeScript.** The core is generic over the host node type and typechecks
  under `strict`. Run `npm run typecheck` (`tsconfig.check.json` scopes the check
  to the host-agnostic core and the tests).
- **Property testing.** `test/reconciler.property.test.ts` asserts the
  invariants over fast-check-generated element trees: the rendered tree is
  structurally equal to the element tree after every render, no nodes leak,
  re-rendering the same tree reuses everything, unmounting frees and finalizes
  every node, and a keyed reorder preserves every child's identity.
- **Fuzz testing.** `test/reconciler.fuzz.test.ts` drives long random render
  sequences and targeted insert, remove and type-change cases, checking the
  same invariants across hundreds of runs per case.

Run the suite with `npm test` (watch mode: `npm run test:watch`).
