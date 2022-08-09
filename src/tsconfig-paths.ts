import { builtinModules } from 'module'
import { loadConfig, createMatchPath } from 'tsconfig-paths'

const noOp = () => {}

// We use this argument structure so that we can adapt to use configLoader() from 'tsconfig-paths'
// once it becomes exported. This will give even more customizability, including using options
// directly instead of passing in a package.json path.
export function registerTsconfigPaths(args?: { cwd: string }): () => void {
  const configLoaderResult = loadConfig(args?.cwd || process.cwd())

  if (configLoaderResult.resultType === 'failed') {
    return noOp
  }

  const matchPath = createMatchPath(
    configLoaderResult.absoluteBaseUrl,
    configLoaderResult.paths,
    configLoaderResult.mainFields,
    configLoaderResult.addMatchAll,
  )

  // Patch node's module loading
  const Module = require('module')
  const originalResolveFilename = Module._resolveFilename
  // tslint:disable-next-line:no-any
  Module._resolveFilename = function (request: string, _parent: any): string {
    const isCoreModule = builtinModules.includes(request)
    if (!isCoreModule) {
      const found = matchPath(request)
      if (found) {
        const modifiedArguments = [found, ...[].slice.call(arguments, 1)] // Passes all arguments. Even those that is not specified above.
        // tslint:disable-next-line:no-invalid-this
        return originalResolveFilename.apply(this, modifiedArguments)
      }
    }
    // tslint:disable-next-line:no-invalid-this
    return originalResolveFilename.apply(this, arguments)
  }

  return () => {
    // Return node's module loading to original state.
    Module._resolveFilename = originalResolveFilename
  }
}
