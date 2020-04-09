import * as ts from 'typescript';

interface EmitTransformers {
  scriptTransformers: readonly ts.TransformerFactory<ts.SourceFile | ts.Bundle>[];
  declarationTransformers: readonly ts.TransformerFactory<ts.SourceFile | ts.Bundle>[];
}

// NOTE: This exposes TypeScript's internal getTransformers function, which we
// can use to extract the JSX transformer, so we don't have to supply our own
// implementation.
const exposedTS = ts as typeof ts & { getTransformers(opts: ts.CompilerOptions): EmitTransformers };

export default (_program: ts.Program, _options: { value: any }): ts.TransformerFactory<ts.SourceFile | ts.Bundle> => {
  return (context) => (file) => {
    const { scriptTransformers } = exposedTS.getTransformers(context.getCompilerOptions());

    const jsxTransformer = scriptTransformers.find((t) => t.name === 'transformJsx');

    return jsxTransformer?.(context)(file) ?? file;
  };
};
